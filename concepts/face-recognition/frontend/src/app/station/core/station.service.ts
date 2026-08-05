import {
  Injectable,
  Signal,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';

import { ApiService, RecognizedMatch } from '../../api.service';
import { ScaleService } from '../../scale/scale.service';
import { CameraFault, CameraService } from './camera.service';
import { STRINGS } from './i18n';
import {
  CategoryKey,
  ErrorKind,
  Identity,
  Lang,
  LineItem,
  Mode,
  Overlay,
  Person,
  Screen,
  UNSORTED,
  WeighSession,
  isAccount,
  maskPhone,
} from './models';
import { StationDataStore, toPerson } from './station-data';
import { WeighService } from './weigh.service';

export interface RegisterForm {
  fullName: string;
  phone: string;
  age: string;
  city: string;
  ward: string;
  address: string;
  citizenId: string;
}

const EMPTY_FORM: RegisterForm = {
  fullName: '',
  phone: '',
  age: '',
  city: '',
  ward: '',
  address: '',
  citizenId: '',
};

/** Screens that show the in-flow header. */
const IN_FLOW: Screen[] = [
  'identify',
  'confirmed',
  'unknown',
  'register',
  'profile',
  'face',
  'category',
  'weigh',
];

const REQUIRED_PHONE_DIGITS = 8;

export function phoneDigits(phone: string): string {
  return (phone ?? '').replace(/\D/g, '');
}

/**
 * The whole station is one state machine — `screen` decides what's shown, with
 * `overlay` and `error` layering on top. Deliberately not URL-routed (handoff §3).
 */
@Injectable({ providedIn: 'root' })
export class StationService {
  private readonly api = inject(ApiService);
  private readonly scale = inject(ScaleService);
  private readonly camera = inject(CameraService);
  private readonly data = inject(StationDataStore);
  readonly weigh = inject(WeighService);

  // ── state ──
  readonly lang = signal<Lang>('vn');
  readonly screen = signal<Screen>('idle');
  readonly overlay = signal<Overlay>(null);
  readonly error = signal<ErrorKind>(null);
  readonly helpCalled = signal(false);
  readonly mode = signal<Mode>('sorted');
  readonly identity = signal<Identity>(null);
  readonly items = signal<LineItem[]>([]);
  readonly currentCat = signal<CategoryKey | null>(null);

  readonly keypad = signal('');
  readonly keypadBusy = signal(false);
  readonly keypadNotFound = signal(false);

  readonly form = signal<RegisterForm>({ ...EMPTY_FORM });
  readonly facePhotos = signal<Blob[]>([]);
  readonly registering = signal(false);
  readonly registerError = signal(false);

  readonly profileEdit = signal(false);
  readonly pform = signal<Person>({ fullName: '', phone: '' });
  private prevScreen: Screen = 'confirmed';

  /** Face capture launched from the profile screen. */
  readonly savingFaces = signal(false);
  readonly facesError = signal(false);

  /** Set when the person dismisses the scale-offline card, so it doesn't
   *  immediately reappear while the scale is still down. */
  private readonly scaleAlertMuted = signal(false);

  /** Same idea for the camera card: without it, dismissing on a station with no
   *  camera just re-raises the card on the identify screen's next effect run. */
  private readonly cameraAlertMuted = signal(false);
  /** Drives the card's wording and whether a retry button is worth offering. */
  readonly cameraFault = signal<CameraFault | null>(null);

  // ── derived ──
  readonly L = computed(() => STRINGS[this.lang()]);
  readonly inFlow = computed(() => IN_FLOW.includes(this.screen()));
  readonly canBack = computed(() => this.inFlow() && this.screen() !== 'identify');
  readonly showRail = computed(() => this.screen() === 'category' || this.screen() === 'weigh');
  readonly isAnon = computed(() => this.identity() === 'anon');
  readonly account = computed<Person | null>(() => {
    const id = this.identity();
    return isAccount(id) ? id : null;
  });

  readonly idName = computed(() => {
    const id = this.identity();
    if (!id) return '—';
    return id === 'anon' ? this.L().guest : id.fullName;
  });

  readonly idPhone = computed(() => {
    const id = this.identity();
    if (!id) return '';
    return id === 'anon' ? this.L().noPhone : id.phone;
  });

  readonly sessionTotal = computed(() =>
    this.items().reduce((sum, i) => sum + i.weight, 0),
  );

  /** Lifetime totals and history come from the backend (see StationDataStore). */
  readonly personalTotal = this.data.personalTotal.asReadonly();
  readonly communityTotal = this.data.communityTotal.asReadonly();
  readonly communityGoal = this.data.communityGoal.asReadonly();
  readonly sessions: Signal<WeighSession[]> = this.data.sessions.asReadonly();
  readonly memberSince = this.data.memberSince.asReadonly();

  readonly canSubmitRegister = computed(() => {
    const f = this.form();
    return (
      f.fullName.trim().length > 0 && phoneDigits(f.phone).length >= REQUIRED_PHONE_DIGITS
    );
  });

  private nextItemId = 1;

  constructor() {
    // The scale is wired over WebSocket to the ESP32 bridge; connect once at
    // boot. No address is passed: booting is not the operator choosing one, and
    // persisting it here is what used to freeze the default (see ScaleService).
    this.scale.connect();

    // Station total for the summary, plus any sessions stranded by an outage.
    void this.data.loadStats();
    void this.data.flushOutbox();

    // Surface a scale outage only where it actually blocks the person. `error` is
    // read untracked so raising it can't re-trigger this effect, and a dismissal
    // stays dismissed until the scale comes back (otherwise the card is
    // undismissable for as long as the scale is down).
    effect(() => {
      const weighing = this.screen() === 'weigh';
      const connected = this.scale.status() === 'connected';
      const muted = this.scaleAlertMuted();
      untracked(() => {
        if (connected) {
          this.scaleAlertMuted.set(false);
          if (this.error() === 'scale') this.error.set(null);
        } else if (weighing && !muted && this.error() === null) {
          this.error.set('scale');
        }
      });
    });

    addEventListener('offline', () => this.error.set('network'));
    addEventListener('online', () => {
      if (this.error() === 'network') this.error.set(null);
    });
  }

  // ── language ──
  toggleLang(): void {
    this.lang.update((l) => (l === 'vn' ? 'en' : 'vn'));
  }

  // ── entry ──
  startSorted(): void {
    this.beginSession('sorted');
  }

  startQuick(): void {
    this.beginSession('quick');
  }

  private beginSession(mode: Mode): void {
    this.weigh.reset();
    this.mode.set(mode);
    this.identity.set(null);
    this.data.clearPerson();
    this.items.set([]);
    this.currentCat.set(null);
    this.overlay.set(null);
    this.screen.set('identify');
  }

  /** The single router that respects `mode` — quick mode never sees the tile grid. */
  enter(): void {
    this.overlay.set(null);
    if (this.mode() === 'quick') this.pick(UNSORTED);
    else this.screen.set('category');
  }

  /** Confirmed "yes", or a successful keypad lookup. */
  start(): void {
    if (!this.identity()) this.identity.set('anon');
    this.enter();
  }

  skip(): void {
    this.identity.set('anon');
    this.enter();
  }

  notMe(): void {
    this.identity.set(null);
    this.screen.set('unknown');
  }

  /** A face or QR match came back from IdentifyService. */
  identifiedAs(match: RecognizedMatch): void {
    // Show the greeting straight away off the match, then fill in the stored
    // profile and history — the person shouldn't wait on a round trip.
    this.identity.set({
      code: match.code,
      fullName: match.full_name,
      phone: maskPhone(match.code),
    });
    this.screen.set('confirmed');
    void this.hydrate(match.code);
  }

  /** Replaces the placeholder identity with the stored record, if there is one. */
  private async hydrate(code: string): Promise<void> {
    const person = await this.data.loadPerson(code);
    if (person && this.account()?.code === code) this.identity.set(person);
  }

  /** Detection is confident this person isn't enrolled. */
  identifiedAsUnknown(): void {
    this.identity.set(null);
    this.screen.set('unknown');
  }

  /** A QR from the Tagom app. The payload carries the account code — accept a bare
   *  code or a tagom URL ending in one. Unrecognised codes fall through to onboarding. */
  async identifiedByQr(payload: string): Promise<void> {
    const code = phoneDigits(payload.split(/[/?#]/).filter(Boolean).pop() ?? '');
    if (!code) {
      this.identifiedAsUnknown();
      return;
    }
    const person = await this.data.loadPerson(code);
    if (person) {
      this.identity.set(person);
      this.screen.set('confirmed');
      return;
    }
    this.identifiedAsUnknown();
  }

  // ── register ──
  goRegister(): void {
    this.registerError.set(false);
    this.screen.set('register');
  }

  updateForm(patch: Partial<RegisterForm>): void {
    this.form.update((f) => ({ ...f, ...patch }));
  }

  addFacePhoto(blob: Blob): void {
    this.facePhotos.update((list) => (list.length >= 5 ? list : [...list, blob]));
  }

  retakeFaces(): void {
    this.facePhotos.set([]);
  }

  async submitRegister(): Promise<void> {
    if (!this.canSubmitRegister() || this.registering()) return;
    const f = this.form();
    const code = phoneDigits(f.phone);
    this.registering.set(true);
    this.registerError.set(false);

    const profile = {
      phone: maskPhone(f.phone),
      age: f.age.trim(),
      city: f.city.trim(),
      ward: f.ward.trim(),
      address: f.address.trim(),
      citizen_id: f.citizenId.trim(),
    };

    try {
      const photos = this.facePhotos();
      let saved: Person | null;
      if (photos.length) {
        // Face photos become the embedding the identify screen matches against;
        // enroll writes the profile in the same call.
        await this.api.enroll(code, f.fullName.trim(), '', photos, profile);
        saved = await this.data.loadPerson(code);
      } else {
        saved = toPerson(await this.api.createPerson(code, f.fullName.trim(), profile));
      }

      this.identity.set(saved ?? { code, fullName: f.fullName.trim(), phone: profile.phone });
      this.form.set({ ...EMPTY_FORM });
      this.facePhotos.set([]);
      this.enter();
    } catch {
      this.registerError.set(true);
    } finally {
      this.registering.set(false);
    }
  }

  // ── weighing ──
  pick(key: CategoryKey): void {
    this.currentCat.set(key);
    this.screen.set('weigh');
    this.weigh.start((weight) => this.addItem(key, weight));
  }

  private addItem(key: CategoryKey, weight: number): void {
    this.items.update((list) => [...list, { id: this.nextItemId++, key, weight }]);
  }

  /** "Weigh another" — quick mode loops straight into another unsorted weigh. */
  pickAgain(): void {
    this.weigh.reset();
    if (this.mode() === 'quick') this.pick(UNSORTED);
    else this.screen.set('category');
  }

  reweigh(): void {
    const key = this.currentCat();
    if (!key) return;
    // Drop the row this weigh already produced, then run the scale again.
    if (this.weigh.phase() === 'locked') this.items.update((list) => list.slice(0, -1));
    this.weigh.start((weight) => this.addItem(key, weight));
  }

  removeItem(id: number): void {
    this.items.update((list) => list.filter((i) => i.id !== id));
  }

  gotoSummary(): void {
    if (!this.items().length) return;
    this.weigh.reset();
    this.screen.set('summary');
    // Totals move optimistically inside recordSession, so the summary reads
    // correctly immediately; a failed upload is queued, not lost.
    void this.data.recordSession(
      this.account()?.code ?? null,
      this.items().map((i) => ({ key: i.key, weight: i.weight })),
    );
  }

  reset(): void {
    this.weigh.reset();
    this.screen.set('idle');
    this.overlay.set(null);
    this.error.set(null);
    this.items.set([]);
    this.identity.set(null);
    // The next person must not see the last one's history.
    this.data.clearPerson();
    this.currentCat.set(null);
    this.keypad.set('');
    this.keypadNotFound.set(false);
    this.form.set({ ...EMPTY_FORM });
    this.facePhotos.set([]);
    this.profileEdit.set(false);
    this.helpCalled.set(false);
    this.scaleAlertMuted.set(false);
    // A remembered camera fault is deliberately NOT cleared here: the next
    // person at a station with no camera should not be prompted all over again.
    this.cameraAlertMuted.set(false);
  }

  back(): void {
    switch (this.screen()) {
      case 'weigh':
        this.weigh.reset();
        if (this.mode() === 'quick') this.reset();
        else this.screen.set('category');
        break;
      case 'category':
        this.reset();
        break;
      case 'confirmed':
      case 'unknown':
        this.identity.set(null);
        this.screen.set('identify');
        break;
      case 'register':
        this.screen.set('unknown');
        break;
      case 'face':
        // Launched from the profile screen; drop any half-taken photos.
        this.facePhotos.set([]);
        this.screen.set('profile');
        break;
      case 'profile':
        this.screen.set(this.prevScreen);
        break;
      default:
        this.reset();
    }
  }

  // ── overlays ──
  /** "End session" from the header — always confirms first (a stray tap must not
   *  discard a weigh or a half-filled registration). Opening the overlay pauses
   *  the identify auto-detect via the same effect every overlay relies on. */
  openEndConfirm(): void {
    this.overlay.set('endconfirm');
  }

  /** Confirmed "yes, end it": back to idle for the next person. reset() clears
   *  the overlay too. */
  confirmEnd(): void {
    this.reset();
  }

  closeEndConfirm(): void {
    this.overlay.set(null);
  }

  openHelp(): void {
    this.helpCalled.set(false);
    this.overlay.set('help');
  }

  callStaff(): void {
    // Staff are on their way — don't keep re-raising the card behind the overlay.
    this.dismissError();
    this.helpCalled.set(true);
    this.overlay.set('help');
  }

  closeHelp(): void {
    this.helpCalled.set(false);
    this.overlay.set(null);
  }

  openKeypad(): void {
    this.keypad.set('');
    this.keypadNotFound.set(false);
    this.overlay.set('keypad');
  }

  closeKeypad(): void {
    this.overlay.set(null);
  }

  pressKey(digit: string): void {
    this.keypadNotFound.set(false);
    this.keypad.update((v) => (v + digit).slice(0, 11));
  }

  deleteKey(): void {
    this.keypadNotFound.set(false);
    this.keypad.update((v) => v.slice(0, -1));
  }

  /** Look the phone number up; falls through to an anonymous session if unknown. */
  async lookupPhone(): Promise<void> {
    const code = phoneDigits(this.keypad());
    if (code.length < REQUIRED_PHONE_DIGITS || this.keypadBusy()) return;
    this.keypadBusy.set(true);
    this.keypadNotFound.set(false);
    try {
      const person = await this.data.loadPerson(code);
      if (person) {
        this.identity.set(person);
        this.screen.set('confirmed');
        this.overlay.set(null);
      } else {
        this.keypadNotFound.set(true);
      }
    } catch {
      this.keypadNotFound.set(true);
    } finally {
      this.keypadBusy.set(false);
    }
  }

  openNoFace(): void {
    this.overlay.set('noface');
  }

  closeNoFace(): void {
    this.overlay.set(null);
  }

  noFaceFirstTime(): void {
    this.identity.set(null);
    this.overlay.set(null);
    this.screen.set('unknown');
  }

  noFaceRetry(): void {
    this.overlay.set(null);
    this.screen.set('identify');
  }

  noFacePhone(): void {
    this.openKeypad();
  }

  showError(kind: Exclude<ErrorKind, null>): void {
    this.overlay.set(null);
    this.error.set(kind);
  }

  /** Raises the camera card unless the person already dismissed it. */
  reportCameraFault(fault: CameraFault): void {
    this.cameraFault.set(fault);
    if (this.cameraAlertMuted()) return;
    this.showError('camera');
  }

  /** Explicit "try again" from the card — the only path that re-asks for
   *  permission once a fault has been recorded. */
  retryCamera(): void {
    this.camera.retry();
    this.cameraFault.set(null);
    this.cameraAlertMuted.set(false);
    this.error.set(null);
  }

  dismissError(): void {
    if (this.error() === 'scale') this.scaleAlertMuted.set(true);
    if (this.error() === 'camera') this.cameraAlertMuted.set(true);
    this.error.set(null);
  }

  // ── profile ──
  openProfile(): void {
    if (!this.account()) return;
    const from = this.screen();
    this.prevScreen = from === 'identify' || from === 'profile' ? 'confirmed' : from;
    this.profileEdit.set(false);
    this.overlay.set(null);
    this.screen.set('profile');
  }

  editProfile(): void {
    const acc = this.account();
    if (!acc) return;
    this.pform.set({ ...acc });
    this.profileEdit.set(true);
  }

  /** From the profile screen: take (or re-take) this person's face photos so
   *  face scanning works next time. Starts from an empty set. */
  startFaceCapture(): void {
    if (!this.account()) return;
    this.facePhotos.set([]);
    this.facesError.set(false);
    this.screen.set('face');
  }

  /** Enrol the freshly captured photos against the current account, replacing any
   *  existing faces so a re-take fully supersedes the old set. The person and
   *  their history are untouched; on success, return to the profile. */
  async submitFaces(): Promise<void> {
    const acc = this.account();
    const photos = this.facePhotos();
    if (!acc?.code || !photos.length || this.savingFaces()) return;
    this.savingFaces.set(true);
    this.facesError.set(false);
    try {
      await this.api.enroll(acc.code, acc.fullName, '', photos, {}, true);
      const person = await this.data.loadPerson(acc.code);
      if (person) this.identity.set(person);
      this.facePhotos.set([]);
      this.screen.set('profile');
    } catch {
      // Keep the photos so the person can just tap Save again.
      this.facesError.set(true);
    } finally {
      this.savingFaces.set(false);
    }
  }

  cancelEdit(): void {
    this.profileEdit.set(false);
  }

  updatePForm(patch: Partial<Person>): void {
    this.pform.update((p) => ({ ...p, ...patch }));
  }

  async saveProfile(): Promise<void> {
    const acc = this.account();
    const edited = this.pform();
    if (!acc?.code) return;

    // Show the edit as applied straight away; the server is the record of truth
    // and its response replaces this if it differs.
    this.identity.set({ ...edited, code: acc.code });
    this.profileEdit.set(false);
    try {
      const saved = await this.api.updatePerson(acc.code, {
        full_name: edited.fullName,
        phone: edited.phone,
        age: edited.age ?? '',
        city: edited.city ?? '',
        ward: edited.ward ?? '',
        address: edited.address ?? '',
        citizen_id: edited.citizenId ?? '',
      });
      this.identity.set(toPerson(saved));
    } catch {
      this.error.set('network');
    }
  }
}
