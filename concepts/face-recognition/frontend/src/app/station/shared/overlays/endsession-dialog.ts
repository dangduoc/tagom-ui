import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { StationService } from '../../core/station.service';
import { TgDialog } from '../tg-dialog';
import { TgIcon } from '../tg-icon';

/** "End session?" confirm — the only path from the in-flow header back to idle,
 *  so a person can abandon a session at any point and hand a clean start to the
 *  next one. Always confirms; the primary action returns to the idle screen. */
@Component({
  selector: 'tg-endsession-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TgDialog, TgIcon],
  template: `
    <tg-dialog [width]="520">
      <div class="body">
        <span class="badge"><tg-icon name="arrow-left" [size]="40" [strokeWidth]="2.2" /></span>
        <h2 class="tg-display">{{ station.L().endTitle }}</h2>
        <p class="sub">{{ station.L().endBody }}</p>
        <div class="actions">
          <button type="button" class="keep" (click)="station.closeEndConfirm()">
            {{ station.L().keepGoing }}
          </button>
          <button type="button" class="end" (click)="station.confirmEnd()">
            {{ station.L().endConfirm }}
          </button>
        </div>
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
      margin: 0 0 12px;
      text-align: center;
      text-wrap: pretty;
      line-height: 1.25;
      font-size: 27px;
    }
    .sub {
      margin: 0 0 28px;
      color: var(--text-muted);
      text-align: center;
      text-wrap: pretty;
      line-height: 1.4;
      font-size: 18px;
    }
    .actions {
      display: flex;
      gap: 12px;
    }
    .actions button {
      flex: 1;
      border-radius: var(--radius-lg);
      padding: 20px 26px;
      font-weight: var(--fw-bold);
      font-size: 21px;
    }
    .keep {
      border: 1.5px solid var(--border-strong);
      color: var(--tagom-green);
    }
    .end {
      border: 1.5px solid transparent;
      background: var(--tagom-green);
      color: var(--tagom-lime);
    }
  `,
})
export class EndSessionDialog {
  readonly station = inject(StationService);
}
