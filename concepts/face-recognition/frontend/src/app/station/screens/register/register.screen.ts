import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FaceDetector } from '@mediapipe/tasks-vision';

import { createFaceDetector } from '../../../face-detection';
import { captureFrame, closeCamera, openCamera } from '../../core/camera';
import { StationService } from '../../core/station.service';
import { TgIcon } from '../../shared/tg-icon';

const MAX_PHOTOS = 5;
const FACE_CHECK_MS = 250;

/** Main info + the optional 5-image facial capture that becomes the embedding
 *  vector the identify screen later matches against (handoff §5.5). */
@Component({
  selector: 'tg-register-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TgIcon],
  templateUrl: './register.screen.html',
  styleUrl: './register.screen.scss',
})
export class RegisterScreen implements AfterViewInit, OnDestroy {
  readonly station = inject(StationService);

  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  readonly slots = [0, 1, 2, 3, 4];
  readonly cameraError = signal<string | null>(null);
  /** Faces in view; null = camera off or detector unavailable (capture stays ungated). */
  readonly faceCount = signal<number | null>(null);

  readonly photoCount = computed(() => this.station.facePhotos().length);
  readonly faceComplete = computed(() => this.photoCount() >= MAX_PHOTOS);
  readonly captureBlocked = computed(
    () => this.faceComplete() || (this.faceCount() !== null && this.faceCount() !== 1),
  );

  private stream: MediaStream | null = null;
  private detector: FaceDetector | null = null;
  private faceCheckTimer = 0;

  async ngAfterViewInit(): Promise<void> {
    const video = this.videoRef().nativeElement;
    try {
      this.stream = await openCamera(video);
    } catch (err) {
      this.cameraError.set(err instanceof Error ? err.message : String(err));
      return;
    }
    try {
      this.detector ??= await createFaceDetector();
    } catch {
      return; // Capture stays ungated; the backend still validates each photo.
    }
    this.faceCheckTimer = window.setInterval(() => {
      if (!this.stream || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      this.faceCount.set(this.detector!.detectForVideo(video, performance.now()).detections.length);
    }, FACE_CHECK_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.faceCheckTimer);
    closeCamera(this.stream, this.videoRef().nativeElement);
    this.stream = null;
    this.detector?.close();
    this.detector = null;
  }

  async capture(): Promise<void> {
    if (this.captureBlocked() || !this.stream) return;
    this.station.addFacePhoto(await captureFrame(this.videoRef().nativeElement));
  }

  field(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
