import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';

import { ApiService, EnrollFileResult, PersonInfo } from '../api.service';
import { CAPTURE_STEPS, CapturedPhoto, CaptureModal } from './capture-modal/capture-modal';

@Component({
  selector: 'app-enroll',
  imports: [
    FormsModule,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonNote,
    IonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './enroll.page.html',
  styleUrl: './enroll.page.scss',
})
export class EnrollPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly modalCtrl = inject(ModalController);

  code = '';
  fullName = '';
  department = '';

  readonly photos = signal<CapturedPhoto[]>([]);
  readonly submitting = signal(false);
  readonly message = signal<string | null>(null);
  readonly messageIsError = signal(false);
  readonly fileResults = signal<EnrollFileResult[]>([]);
  readonly people = signal<PersonInfo[]>([]);

  readonly steps = CAPTURE_STEPS;
  readonly maxPhotos = CAPTURE_STEPS.length;

  async ngOnInit(): Promise<void> {
    await this.refreshPeople();
  }

  ngOnDestroy(): void {
    this.photos().forEach((p) => URL.revokeObjectURL(p.url));
  }

  /** Open the dedicated capture modal; on Finish its photos replace the current set. */
  async openCaptureModal(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: CaptureModal });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<CapturedPhoto[]>();
    if (role === 'finish' && data?.length) {
      this.photos().forEach((p) => URL.revokeObjectURL(p.url));
      this.photos.set(data);
    }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    for (const file of Array.from(input.files ?? [])) {
      if (this.photos().length >= this.maxPhotos) break;
      this.photos.update((list) => [
        ...list,
        { blob: file, url: URL.createObjectURL(file), label: 'Tải lên' },
      ]);
    }
    input.value = '';
  }

  removePhoto(index: number): void {
    const photo = this.photos()[index];
    URL.revokeObjectURL(photo.url);
    this.photos.update((list) => list.filter((_, i) => i !== index));
  }

  canSubmit(): boolean {
    return (
      !this.submitting() &&
      this.code.trim().length > 0 &&
      this.fullName.trim().length > 0 &&
      this.photos().length > 0
    );
  }

  async submit(form: NgForm): Promise<void> {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.message.set(null);
    this.fileResults.set([]);
    try {
      const res = await this.api.enroll(
        this.code.trim(),
        this.fullName.trim(),
        this.department.trim(),
        this.photos().map((p) => p.blob),
      );
      this.fileResults.set(res.files);
      this.showMessage(
        `Đã đăng ký ${res.enrolled_photos} ảnh cho ${this.fullName.trim()}.`,
        false,
      );
      this.photos().forEach((p) => URL.revokeObjectURL(p.url));
      this.photos.set([]);
      form.resetForm({ code: '', name: '', department: '' });
      await this.refreshPeople();
    } catch (err) {
      this.showMessage(err instanceof Error ? err.message : String(err), true);
    } finally {
      this.submitting.set(false);
    }
  }

  async deletePerson(code: string): Promise<void> {
    if (!confirm(`Xóa ${code} và toàn bộ dữ liệu khuôn mặt?`)) return;
    try {
      await this.api.deletePerson(code);
      await this.refreshPeople();
    } catch (err) {
      this.showMessage(err instanceof Error ? err.message : String(err), true);
    }
  }

  private async refreshPeople(): Promise<void> {
    try {
      this.people.set(await this.api.listPeople());
    } catch {
      this.showMessage('Không tải được danh sách — máy chủ đã chạy chưa?', true);
    }
  }

  private showMessage(text: string, isError: boolean): void {
    this.message.set(text);
    this.messageIsError.set(isError);
  }
}
