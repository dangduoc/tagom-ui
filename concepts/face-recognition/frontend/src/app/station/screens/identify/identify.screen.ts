import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
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
    this.identify.stop();
  }

  private async startDetection(): Promise<void> {
    await this.identify.start(this.videoRef().nativeElement, (r) => this.onResult(r));
    if (this.identify.cameraError()) this.station.showError('camera');
  }

  private onResult(result: IdentifyResult): void {
    switch (result.kind) {
      case 'face':
        this.station.identifiedAs(result.match);
        break;
      case 'qr':
        void this.station.identifiedByQr(result.payload);
        break;
      case 'unknown':
        this.station.identifiedAsUnknown();
        break;
    }
  }
}
