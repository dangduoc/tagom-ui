import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';

import { IdentifyResult, IdentifyService } from '../../core/identify.service';
import { StationService } from '../../core/station.service';
import { TgIcon } from '../../shared/tg-icon';

@Component({
  selector: 'tg-identify-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TgIcon],
  templateUrl: './identify.screen.html',
  styleUrl: './identify.screen.scss',
})
export class IdentifyScreen implements OnDestroy {
  readonly station = inject(StationService);
  readonly identify = inject(IdentifyService);

  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  /** What the chip inside the camera view says. A dead camera takes priority —
   *  "Đang tìm…" while nothing is being scanned is a lie. */
  readonly statusText = computed(() => {
    const L = this.station.L();
    if (this.identify.cameraFault()) return L.errCameraTitle;
    if (this.identify.checking()) return L.searching;
    if (this.identify.unrecognized()) return L.notRecognized;
    return L.scanning;
  });

  /** Settled states (camera down, or nobody recognised) — warm chip, no blink. */
  readonly statusSettled = computed(
    () =>
      !!this.identify.cameraFault() ||
      (this.identify.unrecognized() && !this.identify.checking()),
  );

  constructor() {
    // Detection must be paused whenever an overlay or error card is up. Otherwise
    // a match lands while the person is mid-keypad and yanks the screen out from
    // under them — the exact bug called out in handoff §8.1.
    effect(() => {
      const shouldRun =
        this.station.screen() === 'identify' &&
        this.station.overlay() === null &&
        this.station.error() === null;

      if (shouldRun) void this.startDetection();
      else this.identify.stop();
    });
  }

  ngOnDestroy(): void {
    // Only here do we hand the camera back — stop() above just pauses detection,
    // so overlays and error cards don't cause a re-prompt.
    this.identify.release();
  }

  private async startDetection(): Promise<void> {
    await this.identify.start(this.videoRef().nativeElement, (r) => this.onResult(r));
    const fault = this.identify.cameraFault();
    if (fault) this.station.reportCameraFault(fault);
  }

  private onResult(result: IdentifyResult): void {
    switch (result.kind) {
      case 'face':
        this.station.identifiedAs(result.match);
        break;
      case 'qr':
        void this.station.identifiedByQr(result.payload);
        break;
    }
  }
}
