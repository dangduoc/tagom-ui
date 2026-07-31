import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { ApiService, RecognizedMatch } from '../../api.service';
import { ScaleService } from '../../scale/scale.service';
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
import { StationDataStore } from './station-data';
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

  /** Bumped whenever a session is recorded, so totals recompute from storage. */
  private readonly dataVersion = signal(0);
  /** Set when the person dismisses the scale-offline card, so it doesn't
   *  immediately reappear while the scale is still down. */
  private readonly scaleAlertMuted = signal(false);

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

  readonly personalTotal = computed(() => {
    this.dataVersion();
    const acc = this.account();
    if (!acc?.code) return this.sessionTotal();
    // Storage already includes this session once it's been recorded on Finish.
    return this.data.personalTotal(acc.code) || this.sessionTotal();
  });

  readonly communityTotal = computed(() => {
    this.dataVersion();
    return this.data.communityTotal();
  });

  readonly sessions = computed<WeighSession[]>(() => {
    this.dataVersion();
    const acc = this.account();
    return acc?.code ? this.data.sessions(acc.code) : [];
  });

  readonly memberSince = computed(() => {
    this.dataVersion();
    const acc = this.account();
    return acc?.code ? this.data.memberSince(acc.code) : '';
  });

  readonly canSubmitRegister = computed(() => {
    const f = this.form();
    return (
      f.fullName.trim().length > 0 && phoneDigits(f.phone).length >= REQUIRED_PHONE_DIGITS
    );
  });

  private nextItemId = 1;

  constructor() {
    // The scale is wired over WebSocket to the ESP32 bridge; connect once at boot.
    this.scale.connect(this.scale.getUrl());

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
    this.identity.set(this.personFromCode(match.employee_code, match.full_name));
    this.screen.set('confirmed');
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
    const local = this.data.getPerson(code);
    if (local) {
      this.identity.set(local);
      this.screen.set('confirmed');
      return;
    }
    try {
      const employees = await this.api.listEmployees();
      const hit = employees.find((e) => e.employee_code === code);
      if (hit) {
        this.identity.set(this.personFromCode(hit.employee_code, hit.full_name));
        this.screen.set('confirmed');
        return;
      }
    } catch {
      // Fall through to onboarding rather than stranding the person on a spinner.
    }
    this.identifiedAsUnknown();
  }

  private personFromCode(code: string, fullName: string): Person {
    const stored = this.data.getPerson(code);
    return {
      ...(stored ?? {}),
      code,
      fullName: stored?.fullName || fullName,
      phone: stored?.phone || maskPhone(code),
    };
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

    try {
      const photos = this.facePhotos();
      if (photos.length) {
        // Face photos become the embedding vector the identify screen matches against.
        await this.api.enroll(code, f.fullName.trim(), '', photos);
      }
      const person = this.data.savePerson({
        code,
        fullName: f.fullName.trim(),
        phone: maskPhone(f.phone),
        age: f.age.trim() || undefined,
        city: f.city.trim() || undefined,
        ward: f.ward.trim() || undefined,
        address: f.address.trim() || undefined,
        citizenId: f.citizenId.trim() || undefined,
      });
      this.dataVersion.update((v) => v + 1);
      this.identity.set(person);
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
    const acc = this.account();
    this.data.addSession(
      acc?.code ?? '',
      this.items().map((i) => ({ key: i.key, weight: i.weight })),
    );
    this.dataVersion.update((v) => v + 1);
    this.screen.set('summary');
  }

  reset(): void {
    this.weigh.reset();
    this.screen.set('idle');
    this.overlay.set(null);
    this.error.set(null);
    this.items.set([]);
    this.identity.set(null);
    this.currentCat.set(null);
    this.keypad.set('');
    this.keypadNotFound.set(false);
    this.form.set({ ...EMPTY_FORM });
    this.facePhotos.set([]);
    this.profileEdit.set(false);
    this.helpCalled.set(false);
    this.scaleAlertMuted.set(false);
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
      case 'profile':
        this.screen.set(this.prevScreen);
        break;
      default:
        this.reset();
    }
  }

  // ── overlays ──
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
      const local = this.data.getPerson(code);
      if (local) {
        this.identity.set(local);
        this.screen.set('confirmed');
        this.overlay.set(null);
        return;
      }
      const employees = await this.api.listEmployees();
      const hit = employees.find((e) => e.employee_code === code);
      if (hit) {
        this.identity.set(this.personFromCode(hit.employee_code, hit.full_name));
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

  dismissError(): void {
    if (this.error() === 'scale') this.scaleAlertMuted.set(true);
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

  cancelEdit(): void {
    this.profileEdit.set(false);
  }

  updatePForm(patch: Partial<Person>): void {
    this.pform.update((p) => ({ ...p, ...patch }));
  }

  saveProfile(): void {
    const acc = this.account();
    const edited = this.pform();
    if (!acc?.code) return;
    const saved = this.data.savePerson({ ...edited, code: acc.code });
    this.identity.set(saved);
    this.dataVersion.update((v) => v + 1);
    this.profileEdit.set(false);
  }
}
