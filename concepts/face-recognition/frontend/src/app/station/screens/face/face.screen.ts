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
import { captureFrame } from '../../core/camera';
import { CameraService } from '../../core/camera.service';
import { StationService } from '../../core/station.service';
import { TgIcon } from '../../shared/tg-icon';

const MAX_PHOTOS = 5;
const FACE_CHECK_MS = 250;

/** Add or re-take an existing person's face photos, launched from their profile.
 *  Same guided capture as registration, but it enrols against the account that
 *  is already signed in and replaces any faces already on file. */
@Component({
  selector: 'tg-face-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TgIcon],
  template: `
    <section class="wrap">
      <header class="head">
        <span class="badge"><tg-icon name="face-scan" [size]="26" /></span>
        <h1 class="tg-display">{{ station.L().faceSetupTitle }}</h1>
        <p class="why">{{ station.L().faceWhy }}</p>
      </header>

      <div class="viewport">
        <video #video class="feed" playsinline muted autoplay></video>
        <div class="oval"></div>
        @if (cameraError()) {
          <p class="camerr">{{ station.L().errCameraSub }}</p>
        } @else {
          <p class="guide">{{ station.L().faceGuide }}</p>
        }
      </div>

      <div class="slots">
        @for (i of slots; track i) {
          <div class="slot" [class.filled]="i < photoCount()">
            @if (i < photoCount()) {
              <tg-icon name="check" [size]="22" [strokeWidth]="2.6" />
            } @else {
              <span>{{ i + 1 }}</span>
            }
          </div>
        }
      </div>

      @if (faceComplete()) {
        <div class="done-row">
          <p class="done">
            <tg-icon name="check" [size]="22" [strokeWidth]="2.4" />{{ station.L().faceDone }}
          </p>
          <button type="button" class="retake" (click)="station.retakeFaces()">
            {{ station.L().retake }}
          </button>
        </div>
      } @else {
        <button type="button" class="capture" [disabled]="captureBlocked()" (click)="capture()">
          <tg-icon name="camera" [size]="24" [strokeWidth]="1.9" />
          {{ station.L().capturePhoto }} · {{ photoCount() }}/5
        </button>
      }

      @if (station.facesError()) {
        <p class="failed">
          {{ station.facesError() === 'photos' ? station.L().photosNoFace : station.L().faceSaveFailed }}
        </p>
      }

      <button
        type="button"
        class="save"
        [disabled]="!canSave()"
        (click)="station.submitFaces()"
      >
        {{ station.savingFaces() ? station.L().faceSaving : station.L().save }}
      </button>
    </section>
  `,
  styles: `
    .wrap {
      display: flex;
      flex-direction: column;
      gap: 18px;
      margin: 0 auto;
      padding: 32px 24px 40px;
      width: 460px;
      max-width: 100%;
    }
    .head {
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
      border-radius: var(--radius-circle);
      background: var(--tagom-lime);
      width: 64px;
      height: 64px;
      color: var(--tagom-green);
    }
    h1 {
      margin: 0 0 8px;
      text-wrap: pretty;
      line-height: 1.2;
      font-size: 25px;
    }
    .why {
      margin: 0;
      color: var(--text-muted);
      font-size: 16px;
    }
    .viewport {
      display: flex;
      position: relative;
      align-items: center;
      justify-content: center;
      align-self: center;
      border-radius: var(--radius-xl);
      background: #0b1614;
      width: 320px;
      height: 320px;
      max-width: 100%;
      overflow: hidden;
    }
    .feed {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .oval {
      position: absolute;
      border: 2px dashed rgb(255 255 255 / 0.65);
      border-radius: var(--radius-circle);
      width: 62%;
      height: 78%;
    }
    .guide,
    .camerr {
      position: absolute;
      bottom: 12px;
      border-radius: var(--radius-pill);
      background: rgb(11 22 20 / 0.55);
      padding: 6px 14px;
      color: #fff;
      font-size: 14px;
    }
    .slots {
      display: flex;
      gap: 10px;
      justify-content: center;
    }
    .slot {
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid var(--border-strong);
      border-radius: var(--radius-lg);
      width: 52px;
      height: 52px;
      color: var(--text-muted);
      font-weight: var(--fw-bold);
    }
    .slot.filled {
      border-color: transparent;
      background: var(--tagom-green);
      color: var(--tagom-lime);
    }
    .capture,
    .save {
      display: inline-flex;
      gap: 10px;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-pill);
      padding: 16px 24px;
      font-weight: var(--fw-bold);
      font-size: 19px;
    }
    .capture {
      border: 1.5px solid var(--border-strong);
      color: var(--tagom-green);
    }
    .capture:disabled {
      opacity: 0.45;
    }
    .save {
      background: var(--tagom-green);
      color: var(--tagom-lime);
    }
    .save:disabled {
      opacity: 0.45;
    }
    .done-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .done {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      margin: 0;
      color: var(--tagom-green);
      font-weight: var(--fw-bold);
    }
    .retake {
      color: var(--text-muted);
      font-weight: var(--fw-semibold);
      text-decoration: underline;
    }
    .failed {
      margin: 0;
      color: var(--danger, #c0392b);
      text-align: center;
      font-weight: var(--fw-semibold);
    }
  `,
})
export class FaceScreen implements AfterViewInit, OnDestroy {
  readonly station = inject(StationService);
  private readonly camera = inject(CameraService);

  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  readonly slots = [0, 1, 2, 3, 4];
  readonly cameraError = computed(() => this.camera.fault());
  readonly faceCount = signal<number | null>(null);

  readonly photoCount = computed(() => this.station.facePhotos().length);
  readonly faceComplete = computed(() => this.photoCount() >= MAX_PHOTOS);
  readonly captureBlocked = computed(
    () => this.faceComplete() || (this.faceCount() !== null && this.faceCount() !== 1),
  );
  readonly canSave = computed(() => this.photoCount() > 0 && !this.station.savingFaces());

  private stream: MediaStream | null = null;
  private detector: FaceDetector | null = null;
  private faceCheckTimer = 0;

  async ngAfterViewInit(): Promise<void> {
    const video = this.videoRef().nativeElement;
    this.stream = await this.camera.acquire();
    if (!this.stream) return;
    await this.camera.attach(video, this.stream);
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
    this.camera.release(this.videoRef().nativeElement);
    this.stream = null;
    this.detector?.close();
    this.detector = null;
  }

  async capture(): Promise<void> {
    if (this.captureBlocked() || !this.stream) return;
    this.station.addFacePhoto(await captureFrame(this.videoRef().nativeElement));
  }
}
