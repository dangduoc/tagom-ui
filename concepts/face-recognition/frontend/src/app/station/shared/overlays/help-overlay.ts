import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { StationService } from '../../core/station.service';
import { TgDialog } from '../tg-dialog';
import { TgIcon } from '../tg-icon';

@Component({
  selector: 'tg-help-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TgDialog, TgIcon],
  template: `
    <tg-dialog>
      <div class="body">
        @if (station.helpCalled()) {
          <span class="badge"><tg-icon name="check" [size]="48" [strokeWidth]="2.4" /></span>
          <h2 class="tg-display">{{ station.L().helpCalledTitle }}</h2>
          <p>{{ station.L().helpCalledSub }}</p>
          <button type="button" class="cta inline" (click)="station.closeHelp()">
            {{ station.L().dismiss }}
          </button>
        } @else {
          <!-- Green-inked variant: the lime star has no contrast on the white card. -->
          <img src="/tagom/star-green.svg" width="60" height="60" alt="" />
          <h2 class="tg-display">{{ station.L().helpTitle }}</h2>
          <p>{{ station.L().helpSub }}</p>
          <button type="button" class="cta" (click)="station.callStaff()">
            {{ station.L().helpCall }}
          </button>
          <button type="button" class="quiet" (click)="station.closeHelp()">
            {{ station.L().helpClose }}
          </button>
        }
      </div>
    </tg-dialog>
  `,
  styles: `
    .body {
      padding: 48px;
      text-align: center;
    }
    .badge {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 18px;
      border-radius: var(--radius-circle);
      background: var(--lime-100);
      width: 88px;
      height: 88px;
      color: var(--tagom-green);
    }
    h2 {
      margin: 12px 0 10px;
      font-size: 32px;
    }
    p {
      margin: 0 0 32px;
      opacity: 0.7;
      line-height: var(--lh-normal);
      font-size: var(--text-lg);
    }
    .cta {
      border-radius: var(--radius-pill);
      background: var(--tagom-green);
      padding: 22px;
      width: 100%;
      color: var(--tagom-lime);
      letter-spacing: 0.03em;
      font-weight: var(--fw-bold);
      font-size: var(--text-h3);
      text-transform: uppercase;
    }
    .cta.inline {
      padding: 20px 44px;
      width: auto;
    }
    .quiet {
      margin-top: 14px;
      padding: 14px;
      width: 100%;
      color: var(--tagom-green);
      font-weight: var(--fw-bold);
      font-size: var(--text-lg);
    }
  `,
})
export class HelpOverlay {
  readonly station = inject(StationService);
}
