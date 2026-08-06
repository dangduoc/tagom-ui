import { Injectable, computed, inject, signal, untracked } from '@angular/core';
import { FaceDetector } from '@mediapipe/tasks-vision';

import { ApiService, RecognizedMatch } from '../../api.service';
import { createFaceDetector } from '../../face-detection';
import { Box, cropFace, onlyVisible, pickTarget } from './camera';
import { CameraService } from './camera.service';

export type IdentifyResult =
  | { kind: 'face'; match: RecognizedMatch }
  | { kind: 'qr'; payload: string };

/** Don't hammer the backend — one recognition attempt at most this often. */
const RECOGNIZE_INTERVAL_MS = 1200;
/** Consecutive below-threshold results before we call someone unrecognised. */
const UNKNOWN_STREAK = 4;

/**
 * Camera + QR/face detection for the identify screen. Replaces the prototype's
 * 2.8s simulated auto-detect with real detection events.
 *
 * Callers MUST `stop()` when leaving the screen or opening an overlay — the
 * prototype's equivalent bug (a timer firing underneath the user and yanking
 * them to `confirmed` mid-typing) is the one called out in the handoff §8.
 */
@Injectable({ providedIn: 'root' })
export class IdentifyService {
  private readonly api = inject(ApiService);
  private readonly camera = inject(CameraService);

  /** Faces currently in view; null = camera off or detector unavailable. */
  readonly faceCount = signal<number | null>(null);
  readonly running = signal(false);
  /** True while a /api/recognize call is in flight — drives the "checking" chip. */
  readonly checking = signal(false);

  /**
   * Set once we've had enough consecutive non-matches to be confident the person
   * at the kiosk isn't enrolled. Deliberately does NOT navigate anywhere: the
   * person stays on the identify screen — the status chip just says so — and
   * registers or types their phone from there. Cleared when a fresh face appears
   * or detection restarts, and an enrolled person who only needed to reposition
   * is still picked up because scanning continues.
   */
  readonly unrecognized = signal(false);

  /** Why the camera isn't up, or null. Owned by CameraService. */
  readonly cameraFault = computed(() => this.camera.fault());

  private detector: FaceDetector | null = null;
  private barcodeDetector: { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> } | null =
    null;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  /** Guards against a second start() while getUserMedia is still resolving. */
  private starting = false;
  private rafId = 0;
  private lastAttemptAt = 0;
  private inFlight = false;
  private unknownStreak = 0;
  private onResult: ((r: IdentifyResult) => void) | null = null;
  private readonly cropCanvas = document.createElement('canvas');

  /**
   * Opens the camera and starts detecting. Resolves once the stream is live, or
   * immediately if the camera is unavailable — check `cameraFault()` after.
   *
   * `running`/`starting` are read untracked: `start()` is called from an effect,
   * and a tracked read would make that effect re-run every time detection
   * toggles, re-entering here for no reason.
   */
  async start(video: HTMLVideoElement, onResult: (r: IdentifyResult) => void): Promise<void> {
    if (untracked(() => this.running()) || this.starting) return;
    this.starting = true;
    this.onResult = onResult;
    this.video = video;
    this.unknownStreak = 0;
    this.unrecognized.set(false);
    this.lastAttemptAt = 0;

    try {
      this.stream = await this.camera.acquire();
      if (!this.stream) return;
      await this.camera.attach(video, this.stream);
    } catch {
      this.stream = null;
      return;
    } finally {
      this.starting = false;
    }

    // stop() may have been called while the camera was opening.
    if (!this.onResult) return;

    if (!this.detector) {
      try {
        this.detector = await createFaceDetector();
      } catch {
        // Face detection unavailable — QR and the phone-number fallback still work.
        this.detector = null;
      }
    }
    // QR scanning is not supported yet — leave the barcode detector unset so the
    // loop's scanQr call (also commented out) is a no-op. Re-enable both together
    // when QR support lands. TODO: QR support.
    // await this.ensureBarcodeDetector();

    this.running.set(true);
    this.loop();
  }

  /**
   * Stops detecting but leaves the camera open. Overlays and error cards use
   * this: releasing the device here is what made the permission prompt reappear
   * every time one was dismissed.
   */
  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.onResult = null;
    this.inFlight = false;
    this.running.set(false);
    this.checking.set(false);
    this.faceCount.set(null);
    this.unrecognized.set(false);
  }

  /** Stops detecting and hands the camera back. For leaving the screen. */
  release(): void {
    this.stop();
    this.camera.release(this.video ?? undefined);
    this.stream = null;
    this.video = null;
  }

  /** QR is a progressive enhancement — Chrome/Edge ship BarcodeDetector, Safari doesn't. */
  private async ensureBarcodeDetector(): Promise<void> {
    if (this.barcodeDetector) return;
    const ctor = (globalThis as Record<string, any>)['BarcodeDetector'];
    if (!ctor) return;
    try {
      const supported: string[] = await ctor.getSupportedFormats();
      if (!supported.includes('qr_code')) return;
      this.barcodeDetector = new ctor({ formats: ['qr_code'] });
    } catch {
      this.barcodeDetector = null;
    }
  }

  private loop = (): void => {
    const video = this.video;
    if (!this.running() || !video) return;

    if (this.stream && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const now = performance.now();
      // Confine detection to the on-screen crop: the feed is object-fit: cover,
      // so the camera sees wider than the person does. Without this a face in
      // the hidden side margin is recognised when the person thinks they've left.
      const boxes = onlyVisible(video, this.detectFaces(video, now));
      this.faceCount.set(this.detector ? boxes.length : null);

      if (!this.inFlight && now - this.lastAttemptAt >= RECOGNIZE_INTERVAL_MS) {
        this.lastAttemptAt = now;
        // QR scanning is not supported yet. TODO: QR support — re-enable this and
        // ensureBarcodeDetector() in start() together.
        // void this.scanQr(video);
        // The person at the kiosk: biggest face that's also close enough and
        // centred. A distant or edge face (e.g. someone walking past) is ignored.
        const face = pickTarget(video, boxes);
        if (face) {
          this.recognize(video, face);
        } else {
          // Nobody in the visible frame — clear any "not recognised" verdict so
          // the next person starts from a clean scanning state.
          this.unknownStreak = 0;
          this.unrecognized.set(false);
        }
      }
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private detectFaces(video: HTMLVideoElement, now: number): Box[] {
    if (!this.detector) return [];
    try {
      return this.detector
        .detectForVideo(video, now)
        .detections.filter((d) => d.boundingBox)
        .map((d) => ({
          x: d.boundingBox!.originX,
          y: d.boundingBox!.originY,
          width: d.boundingBox!.width,
          height: d.boundingBox!.height,
        }));
    } catch {
      return [];
    }
  }

  private async scanQr(video: HTMLVideoElement): Promise<void> {
    if (!this.barcodeDetector) return;
    try {
      const codes = await this.barcodeDetector.detect(video);
      const payload = codes[0]?.rawValue;
      if (payload && this.running()) this.emit({ kind: 'qr', payload });
    } catch {
      // A failed frame is not interesting — the next one will try again.
    }
  }

  private recognize(video: HTMLVideoElement, box: Box): void {
    const crop = cropFace(video, box, this.cropCanvas);
    if (!crop) return;

    this.inFlight = true;
    this.checking.set(true);
    crop
      .then((blob) => this.api.recognize(blob))
      .then((res) => {
        if (!this.running()) return;
        if (res.match) {
          this.emit({ kind: 'face', match: res.match });
        } else if (res.reason !== 'no_face') {
          // A real below-threshold result (or an empty database) — count it.
          // Enough in a row and we flag it on the chip, but keep scanning rather
          // than leaving the screen (see `unrecognized`).
          this.unknownStreak += 1;
          if (this.unknownStreak >= UNKNOWN_STREAK) this.unrecognized.set(true);
        }
      })
      .catch(() => {
        // Network/server hiccup: keep looking rather than accusing the person.
      })
      .finally(() => {
        this.inFlight = false;
        this.checking.set(false);
      });
  }

  private emit(result: IdentifyResult): void {
    const handler = this.onResult;
    if (!handler) return;
    // One result per session — stop before handing over so nothing fires
    // underneath the screen we're about to leave.
    this.stop();
    handler(result);
  }
}
