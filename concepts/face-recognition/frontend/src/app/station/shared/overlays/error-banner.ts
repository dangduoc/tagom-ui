import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { StationService } from '../../core/station.service';
import { TgDialog } from '../tg-dialog';
import { TgIcon } from '../tg-icon';

@Component({
  selector: 'tg-error-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TgDialog, TgIcon],
  template: `
    <tg-dialog>
      <div class="body" [style.border-top-color]="detail().accent">
        <span class="badge" [style.background]="detail().tint" [style.color]="detail().accent">
          <tg-icon name="warning" [size]="46" [strokeWidth]="2.2" />
        </span>
        <h2 class="tg-display">{{ detail().title }}</h2>
        <p>{{ detail().sub }}</p>
        <div class="actions">
          @if (canRetryCamera()) {
            <button type="button" class="cta" (click)="station.retryCamera()">
              {{ station.L().errCameraRetry }}
            </button>
          } @else {
            <button type="button" class="cta" (click)="station.callStaff()">
              {{ station.L().callStaff }}
            </button>
          }
          <button type="button" class="ghost" (click)="station.dismissError()">
            {{ station.L().dismiss }}
          </button>
        </div>
      </div>
    </tg-dialog>
  `,
  styles: `
    .body {
      border-top: 8px solid var(--status-danger);
      border-radius: var(--radius-xl);
      padding: 44px;
      text-align: center;
    }
    .badge {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 18px;
      border-radius: var(--radius-circle);
      width: 84px;
      height: 84px;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 30px;
    }
    p {
      margin: 0 0 30px;
      opacity: 0.7;
      line-height: var(--lh-normal);
      font-size: var(--text-lg);
    }
    .actions {
      display: flex;
      gap: 14px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .cta {
      border-radius: var(--radius-pill);
      background: var(--accent);
      padding: 18px 34px;
      color: var(--on-accent);
      font-weight: var(--fw-bold);
      font-size: var(--text-lg);
      text-transform: uppercase;
    }
    .ghost {
      border: 1.5px solid var(--border-strong);
      border-radius: var(--radius-pill);
      padding: 18px 34px;
      color: var(--tagom-green);
      font-weight: var(--fw-bold);
      font-size: var(--text-lg);
    }
  `,
})
export class ErrorBanner {
  readonly station = inject(StationService);

  /** Retrying a camera the browser blocked can work once the person allows it.
   *  Retrying one that isn't plugged in cannot, so that case keeps "call staff". */
  readonly canRetryCamera = computed(
    () => this.station.error() === 'camera' && this.station.cameraFault() === 'denied',
  );

  readonly detail = computed(() => {
    const L = this.station.L();
    switch (this.station.error()) {
      case 'network':
        return {
          title: L.errNetworkTitle,
          sub: L.errNetworkSub,
          accent: 'var(--status-warning)',
          tint: '#faf3d6',
        };
      case 'camera':
        return {
          title: L.errCameraTitle,
          sub:
            this.station.cameraFault() === 'denied' ? L.errCameraDeniedSub : L.errCameraSub,
          accent: 'var(--status-info)',
          tint: '#dcecec',
        };
      default:
        return {
          title: L.errScaleTitle,
          sub: L.errScaleSub,
          accent: 'var(--status-danger)',
          tint: '#f7e3e0',
        };
    }
  });
}
