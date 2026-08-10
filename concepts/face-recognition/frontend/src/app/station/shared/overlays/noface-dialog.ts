import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { StationService } from '../../core/station.service';
import { TgDialog } from '../tg-dialog';
import { TgIcon } from '../tg-icon';

/** Face-not-recognised, with the three routes out (handoff §6). */
@Component({
  selector: 'tg-noface-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TgDialog, TgIcon],
  template: `
    <tg-dialog [width]="620">
      <div class="body">
        <span class="badge"><tg-icon name="confused" [size]="44" /></span>
        <h2 class="tg-display">{{ station.L().noFaceTitle }}</h2>
        <div class="routes">
          <button type="button" class="route primary" (click)="station.noFaceFirstTime()">
            <tg-icon name="plus" [size]="26" />
            <span>{{ station.L().nfFirst }}</span>
          </button>
          <button type="button" class="route" (click)="station.noFaceRetry()">
            <tg-icon name="refresh" [size]="26" />
            <span>{{ station.L().nfRetry }}</span>
          </button>
          <button type="button" class="route" (click)="station.noFacePhone()">
            <tg-icon name="id-card" [size]="26" [strokeWidth]="1.9" />
            <span>{{ station.L().nfPhone }}</span>
          </button>
        </div>
        <button type="button" class="quiet" (click)="station.closeNoFace()">
          {{ station.L().dismiss }}
        </button>
      </div>
    </tg-dialog>
  `,
  styles: `
    .body {
      padding: 44px;
    }
    .badge {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      border-radius: var(--radius-circle);
      background: #faf3d6;
      width: 80px;
      height: 80px;
      color: #8a6d10;
    }
    h2 {
      margin: 0 0 26px;
      text-align: center;
      text-wrap: pretty;
      line-height: 1.25;
      font-size: 27px;
    }
    .routes {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .route {
      display: flex;
      gap: 14px;
      align-items: center;
      border: 1.5px solid var(--border-strong);
      border-radius: var(--radius-lg);
      padding: 20px 26px;
      color: var(--tagom-green);
      font-weight: var(--fw-bold);
      font-size: 21px;
    }
    .route span {
      flex: 1;
    }
    .route.primary {
      border-color: transparent;
      background: var(--accent);
      color: var(--on-accent);
    }
    .quiet {
      margin-top: 16px;
      padding: 8px;
      width: 100%;
      opacity: 0.65;
      color: var(--tagom-green);
      text-align: center;
      font-weight: var(--fw-bold);
      font-size: 18px;
    }
  `,
})
export class NoFaceDialog {
  readonly station = inject(StationService);
}
