import {
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { FaceDetector } from '@mediapipe/tasks-vision';

import { ApiService } from '../api.service';
import { createFaceDetector } from '../face-detection';
import { Box, FaceTrack, FaceTracker } from './face-tracker';

/** Re-recognize a track when its cached result is older than this. */
const STALE_MS = 3000;
/** Padding around the detected box when cropping for /api/recognize.
 *  MediaPipe boxes are tight, and the server-side detector fails when the
 *  face fills the whole crop — so pad generously. */
const CROP_PADDING = 0.75;

@Component({
  selector: 'app-live',
  imports: [
    IonButton,
    IonContent,
    IonHeader,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './live.html',
  styleUrl: './live.css',
})
export class Live implements OnDestroy {
  private readonly api = inject(ApiService);

  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('overlay');

  readonly running = signal(false);
  readonly starting = signal(false);
  readonly error = signal<string | null>(null);
  readonly cameras = signal<MediaDeviceInfo[]>([]);
  readonly selectedCameraId = signal<string>('');

  private detector: FaceDetector | null = null;
  private stream: MediaStream | null = null;
  private rafId = 0;
  private readonly tracker = new FaceTracker();
  private readonly cropCanvas = document.createElement('canvas');

  async start(): Promise<void> {
    if (this.running() || this.starting()) return;
    this.starting.set(true);
    this.error.set(null);
    try {
      const deviceId = this.selectedCameraId();
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      const video = this.videoRef().nativeElement;
      video.srcObject = this.stream;
      await video.play();

      const canvas = this.canvasRef().nativeElement;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      await this.refreshCameraList();
      if (!this.detector) this.detector = await createFaceDetector();

      this.running.set(true);
      this.loop();
    } catch (err) {
      this.stopStream();
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.starting.set(false);
    }
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.stopStream();
    this.tracker.clear();
    this.running.set(false);
    const canvas = this.canvasRef().nativeElement;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }

  async onCameraChange(deviceId: string): Promise<void> {
    this.selectedCameraId.set(deviceId);
    if (this.running()) {
      this.stop();
      await this.start();
    }
  }

  ngOnDestroy(): void {
    this.stop();
    this.detector?.close();
    this.detector = null;
  }

  /** Needs an active stream first — labels are empty before permission is granted. */
  private async refreshCameraList(): Promise<void> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    this.cameras.set(devices.filter((d) => d.kind === 'videoinput'));
    if (!this.selectedCameraId()) {
      const current = this.stream?.getVideoTracks()[0]?.getSettings().deviceId;
      if (current) this.selectedCameraId.set(current);
    }
  }

  private loop = (): void => {
    const video = this.videoRef().nativeElement;
    if (this.stream && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const now = performance.now();
      const result = this.detector!.detectForVideo(video, now);
      const boxes: Box[] = result.detections
        .filter((d) => d.boundingBox)
        .map((d) => ({
          x: d.boundingBox!.originX,
          y: d.boundingBox!.originY,
          width: d.boundingBox!.width,
          height: d.boundingBox!.height,
        }));

      const tracks = this.tracker.update(boxes, now);
      for (const track of tracks) this.maybeRecognize(track, now);
      this.draw(tracks);
    }
    if (this.running() || this.stream) this.rafId = requestAnimationFrame(this.loop);
  };

  private maybeRecognize(track: FaceTrack, now: number): void {
    if (track.inFlight) return;
    if (track.lastRecognizedAt !== null && now - track.lastRecognizedAt < STALE_MS) return;

    const crop = this.cropFace(track.box);
    if (!crop) return;

    track.inFlight = true;
    crop
      .then((blob) => this.api.recognize(blob))
      .then((res) => {
        if (res.match) {
          track.state = 'known';
          track.label = res.match.full_name;
          track.similarity = res.match.similarity;
        } else if (res.reason === 'no_face') {
          // Server couldn't find a face in the crop — leave state as-is and retry later
        } else {
          track.state = 'unknown';
          track.label = null;
          track.similarity = res.closest?.similarity ?? null;
        }
      })
      .catch(() => {
        // Network/server error — keep the cached state and retry after STALE_MS
      })
      .finally(() => {
        track.inFlight = false;
        track.lastRecognizedAt = performance.now();
      });
  }

  /** Crop the face region (with padding) from the live video into a JPEG blob. */
  private cropFace(box: Box): Promise<Blob> | null {
    const video = this.videoRef().nativeElement;
    const padX = box.width * CROP_PADDING;
    const padY = box.height * CROP_PADDING;
    const sx = Math.max(0, box.x - padX);
    const sy = Math.max(0, box.y - padY);
    const sw = Math.min(video.videoWidth - sx, box.width + 2 * padX);
    const sh = Math.min(video.videoHeight - sy, box.height + 2 * padY);
    if (sw < 32 || sh < 32) return null;

    this.cropCanvas.width = sw;
    this.cropCanvas.height = sh;
    const ctx = this.cropCanvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

    return new Promise<Blob>((resolve, reject) => {
      this.cropCanvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        0.85,
      );
    });
  }

  private draw(tracks: FaceTrack[]): void {
    const canvas = this.canvasRef().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const track of tracks) {
      const { x, y, width, height } = track.box;
      const color =
        track.state === 'known' ? '#22c55e' : track.state === 'unknown' ? '#ef4444' : '#eab308';

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      const label =
        track.state === 'known'
          ? `${track.label} ${(track.similarity! * 100).toFixed(0)}%`
          : track.state === 'unknown'
            ? 'Unknown'
            : '…';

      ctx.font = 'bold 16px system-ui, sans-serif';
      const textWidth = ctx.measureText(label).width;
      const ly = Math.max(22, y - 6);
      ctx.fillStyle = color;
      ctx.fillRect(x, ly - 18, textWidth + 12, 24);
      ctx.fillStyle = '#111';
      ctx.fillText(label, x + 6, ly);
    }
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    const video = this.videoRef().nativeElement;
    video.srcObject = null;
  }
}
