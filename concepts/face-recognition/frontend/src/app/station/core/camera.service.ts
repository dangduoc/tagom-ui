import { Injectable, computed, signal } from '@angular/core';

/**
 * Why the camera isn't running.
 *
 * `denied`, `missing` and `insecure` are terminal for the session: asking again
 * can only produce another permission prompt or another instant rejection, so
 * `acquire()` refuses to call getUserMedia until `retry()` clears them. `busy`
 * (another app holds the device) can clear on its own, so it is retried — but
 * only a few times, otherwise the identify screen re-prompts on every state
 * change.
 */
export type CameraFault = 'denied' | 'missing' | 'busy' | 'insecure';

/** Attempts allowed for a `busy` device before it's treated as terminal. */
const MAX_TRANSIENT_ATTEMPTS = 3;

/**
 * How long the device stays open after the last holder lets go. Identify and
 * register are separate screens, and the person moves between them in well
 * under a second; without this grace period that hop is a second permission
 * prompt and a visible camera-light flicker.
 */
const RELEASE_GRACE_MS = 1500;

function classify(err: unknown): CameraFault {
  const name = err instanceof DOMException ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'missing';
    default:
      // NotReadableError / AbortError — the device exists but is held elsewhere.
      return 'busy';
  }
}

/**
 * Owns the one MediaStream the station uses.
 *
 * Two rules make the permission prompt behave. The stream outlives overlays and
 * error cards, so pausing detection never releases the device; and a terminal
 * fault is remembered, so a screen that keeps re-entering can't turn a missing
 * camera into a prompt loop.
 */
@Injectable({ providedIn: 'root' })
export class CameraService {
  /** Why the camera is unavailable, or null when it's fine. */
  readonly fault = signal<CameraFault | null>(null);
  readonly live = signal(false);

  /** True when calling getUserMedia again can't help until the user retries. */
  readonly blocked = computed(() => {
    const fault = this.fault();
    if (fault === 'denied' || fault === 'missing' || fault === 'insecure') return true;
    return fault === 'busy' && this.attempts() >= MAX_TRANSIENT_ATTEMPTS;
  });

  private readonly attempts = signal(0);
  private stream: MediaStream | null = null;
  private pending: Promise<MediaStream | null> | null = null;
  private releaseTimer = 0;

  /**
   * The live stream, opening it if necessary. Returns null instead of throwing
   * when the camera is unavailable — read `fault()` for the reason. Safe to call
   * repeatedly: concurrent callers share one getUserMedia, and an already-open
   * stream is handed back without touching the device.
   */
  async acquire(): Promise<MediaStream | null> {
    if (this.releaseTimer) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = 0;
    }
    if (this.stream) return this.stream;
    if (this.blocked()) return null;
    if (this.pending) return this.pending;

    this.pending = this.open();
    try {
      return await this.pending;
    } finally {
      this.pending = null;
    }
  }

  /** Points a <video> at the stream and starts playback. */
  async attach(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
    if (video.srcObject !== stream) video.srcObject = stream;
    if (video.paused) await video.play();
  }

  /**
   * Lets go of the camera. The device is kept open for a moment in case another
   * screen picks it straight back up; call `releaseNow()` to skip that.
   */
  release(video?: HTMLVideoElement): void {
    if (video) video.srcObject = null;
    if (!this.stream || this.releaseTimer) return;
    this.releaseTimer = window.setTimeout(() => this.releaseNow(), RELEASE_GRACE_MS);
  }

  releaseNow(): void {
    if (this.releaseTimer) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = 0;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.live.set(false);
  }

  /** Clears a remembered fault so the next `acquire()` really asks again. */
  retry(): void {
    this.fault.set(null);
    this.attempts.set(0);
  }

  private async open(): Promise<MediaStream | null> {
    const media = navigator.mediaDevices;
    // Undefined on an insecure origin — getUserMedia isn't exposed at all there.
    if (!media?.getUserMedia) {
      this.fault.set('insecure');
      return null;
    }
    // Cheap pre-check: a standing "denied" means we can skip the prompt entirely.
    if (await this.alreadyDenied()) {
      this.fault.set('denied');
      return null;
    }

    this.attempts.update((n) => n + 1);
    try {
      const stream = await media.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      // Unplugging the camera ends the track; drop it so a later acquire() reopens
      // rather than handing out a dead stream.
      stream.getTracks().forEach((t) => t.addEventListener('ended', () => this.onTrackEnded()));
      this.stream = stream;
      this.fault.set(null);
      this.attempts.set(0);
      this.live.set(true);
      return stream;
    } catch (err) {
      this.fault.set(classify(err));
      return null;
    }
  }

  private async alreadyDenied(): Promise<boolean> {
    try {
      // 'camera' isn't a valid permission name in Firefox/Safari — they throw.
      const status = await navigator.permissions?.query({
        name: 'camera' as PermissionName,
      });
      return status?.state === 'denied';
    } catch {
      return false;
    }
  }

  private onTrackEnded(): void {
    if (this.stream?.getTracks().some((t) => t.readyState === 'live')) return;
    this.stream = null;
    this.live.set(false);
  }
}
