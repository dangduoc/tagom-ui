import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { FaceDetector } from '@mediapipe/tasks-vision';

import { createFaceDetector } from '../../face-detection';

/** Guided capture steps — small pose/expression variety near-frontal beats
 *  extreme angles: the recognizer sees people mostly head-on at the camera,
 *  and past ~45° the embedding degrades. */
export interface CaptureStep {
  short: string; // thumbnail label
  title: string;
  hint: string;
}

export const CAPTURE_STEPS: CaptureStep[] = [
  { short: 'Nhìn thẳng', title: 'Nhìn thẳng vào camera', hint: 'mặt tự nhiên, mắt nhìn ống kính' },
  { short: 'Quay trái', title: 'Quay đầu nhẹ sang trái', hint: 'khoảng 20–30°, vẫn thấy cả hai mắt' },
  { short: 'Quay phải', title: 'Quay đầu nhẹ sang phải', hint: 'khoảng 20–30°, vẫn thấy cả hai mắt' },
  { short: 'Ngẩng nhẹ', title: 'Ngẩng cằm lên một chút', hint: 'chỉ cần nghiêng nhẹ là đủ' },
  { short: 'Tự nhiên', title: 'Thêm một ảnh, tự nhiên', hint: 'mỉm cười — hoặc đeo/bỏ kính nếu bạn thỉnh thoảng đeo' },
];

export interface CapturedPhoto {
  blob: Blob;
  url: string; // object URL for the thumbnail
  label: string; // which guide step (or 'Upload')
}

const FACE_CHECK_MS = 250;

/** Fullscreen modal that walks a person through the 5 guided shots.
 *  Dismisses with role 'finish' and the photos as data, or role 'cancel'. */
@Component({
  selector: 'app-capture-modal',
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './capture-modal.html',
  styleUrl: './capture-modal.scss',
})
export class CaptureModal implements AfterViewInit, OnDestroy {
  private readonly modalCtrl = inject(ModalController);
  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  readonly photos = signal<CapturedPhoto[]>([]);
  /** Freshly captured photo awaiting the user's Confirm/Retake decision. */
  readonly review = signal<CapturedPhoto | null>(null);
  readonly showGuide = signal(false);
  readonly cameraError = signal<string | null>(null);
  /** Faces currently in view; null = camera off or detector unavailable. */
  readonly faceCount = signal<number | null>(null);
  /** Which camera to use — 'user' = front (selfie), 'environment' = rear. */
  readonly facingMode = signal<'user' | 'environment'>('user');

  readonly steps = CAPTURE_STEPS;
  readonly maxPhotos = CAPTURE_STEPS.length;

  /** Next guide step to capture, or null when all shots are taken. */
  readonly currentStep = computed<CaptureStep | null>(
    () => CAPTURE_STEPS[this.photos().length] ?? null,
  );

  readonly allTaken = computed(() => this.photos().length >= this.maxPhotos);

  readonly captureBlocked = computed(
    () => this.allTaken() || (this.faceCount() !== null && this.faceCount() !== 1),
  );

  /** The single footer button cycles Capture → Confirm & continue → Finish. */
  readonly primaryLabel = computed(() =>
    this.review() ? 'Tiếp tục' : this.allTaken() ? 'Hoàn tất' : 'Chụp',
  );

  readonly primaryDisabled = computed(
    () => !this.review() && !this.allTaken() && this.captureBlocked(),
  );

  readonly faceStatus = computed<{ ok: boolean; text: string } | null>(() => {
    const count = this.faceCount();
    if (count === null) return null;
    if (count === 1) return { ok: true, text: 'Đã thấy khuôn mặt' };
    if (count === 0) return { ok: false, text: 'Không thấy khuôn mặt' };
    return { ok: false, text: 'Nhiều khuôn mặt — chỉ nên có người trong khung hình' };
  });

  private stream: MediaStream | null = null;
  private detector: FaceDetector | null = null;
  private faceCheckTimer = 0;
  private finished = false;

  async ngAfterViewInit(): Promise<void> {
    await this.startCamera();
  }

  ngOnDestroy(): void {
    clearInterval(this.faceCheckTimer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.detector?.close();
    this.detector = null;
    // Free blob URLs unless the photos were handed to the parent via Finish.
    const pending = this.review();
    if (pending) URL.revokeObjectURL(pending.url);
    if (!this.finished) this.photos().forEach((p) => URL.revokeObjectURL(p.url));
  }

  async startCamera(): Promise<void> {
    this.cameraError.set(null);
    // Release any current stream first — needed when switching cameras.
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.facingMode(),
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      const video = this.videoRef().nativeElement;
      video.srcObject = this.stream;
      await video.play();
      await this.startFaceCheck();
    } catch (err) {
      this.cameraError.set(err instanceof Error ? err.message : String(err));
    }
  }

  /** Flip between the front and rear camera and restart the stream. */
  async switchCamera(): Promise<void> {
    this.facingMode.update((m) => (m === 'user' ? 'environment' : 'user'));
    await this.startCamera();
  }

  primaryAction(): void {
    if (this.review()) this.confirm();
    else if (this.allTaken()) this.finish();
    else void this.capture();
  }

  async capture(): Promise<void> {
    if (this.captureBlocked() || this.review()) return;
    const video = this.videoRef().nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    if (!blob) return;
    const label = this.currentStep()?.short ?? 'Thêm';
    this.review.set({ blob, url: URL.createObjectURL(blob), label });
  }

  confirm(): void {
    const photo = this.review();
    if (!photo) return;
    this.photos.update((list) => [...list, photo]);
    this.review.set(null);
  }

  retake(): void {
    const photo = this.review();
    if (!photo) return;
    URL.revokeObjectURL(photo.url);
    this.review.set(null);
  }

  removePhoto(index: number): void {
    const photo = this.photos()[index];
    URL.revokeObjectURL(photo.url);
    this.photos.update((list) => list.filter((_, i) => i !== index));
  }

  toggleGuide(): void {
    this.showGuide.update((v) => !v);
  }

  cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  finish(): void {
    if (!this.allTaken()) return;
    this.finished = true;
    this.modalCtrl.dismiss(this.photos(), 'finish');
  }

  /** Poll the client-side detector so capture can be gated on exactly one
   *  face being in view. If the detector fails to load, capture stays
   *  ungated (faceCount stays null) — the server still validates photos. */
  private async startFaceCheck(): Promise<void> {
    if (!this.detector) {
      try {
        this.detector = await createFaceDetector();
      } catch {
        return;
      }
    }
    clearInterval(this.faceCheckTimer);
    this.faceCheckTimer = window.setInterval(() => {
      const video = this.videoRef().nativeElement;
      if (!this.stream || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      const result = this.detector!.detectForVideo(video, performance.now());
      this.faceCount.set(result.detections.length);
    }, FACE_CHECK_MS);
  }
}
