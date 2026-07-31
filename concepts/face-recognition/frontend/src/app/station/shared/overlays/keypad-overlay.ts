import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { StationService } from '../../core/station.service';
import { TgDialog } from '../tg-dialog';

@Component({
  selector: 'tg-keypad-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TgDialog],
  template: `
    <tg-dialog [width]="520">
      <div class="body">
        <h2 class="tg-display">{{ station.L().keypadTitle }}</h2>
        <p class="sub">{{ station.L().keypadSub }}</p>
        <output class="display tg-nums">{{ station.keypad() || '—' }}</output>
        @if (station.keypadNotFound()) {
          <p class="notfound">{{ station.L().notFound }}</p>
        }
        <div class="pad">
          @for (d of digits; track d) {
            <button type="button" class="key" (click)="station.pressKey(d)">{{ d }}</button>
          }
          <button type="button" class="key alt" (click)="station.deleteKey()" aria-label="delete">
            ⌫
          </button>
          <button type="button" class="key" (click)="station.pressKey('0')">0</button>
          <button type="button" class="key find" (click)="station.lookupPhone()">
            {{ station.keypadBusy() ? station.L().searching : station.L().lookup }}
          </button>
        </div>
        <button type="button" class="quiet" (click)="station.closeKeypad()">
          {{ station.L().dismiss }}
        </button>
      </div>
    </tg-dialog>
  `,
  styles: `
    .body {
      padding: 40px;
    }
    h2 {
      margin: 0 0 4px;
      text-align: center;
      font-size: 28px;
    }
    .sub {
      margin: 0 0 20px;
      opacity: 0.6;
      text-align: center;
      font-size: 18px;
    }
    .display {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      border-radius: var(--radius-md);
      background: var(--surface-sunken);
      height: 72px;
      letter-spacing: 0.08em;
      font-weight: var(--fw-bold);
      font-size: 38px;
      font-variant-numeric: tabular-nums;
    }
    .notfound {
      margin: -10px 0 14px;
      color: var(--status-danger);
      text-align: center;
      font-weight: var(--fw-semibold);
      font-size: var(--text-body-size);
    }
    .pad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .key {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-md);
      background: var(--surface-sunken);
      height: 64px;
      font-weight: var(--fw-bold);
      font-size: 30px;
      user-select: none;
    }
    .key.alt {
      border: 1px solid var(--border-subtle);
      background: var(--surface-card);
    }
    .key.find {
      background: var(--tagom-green);
      color: var(--tagom-lime);
      font-size: 22px;
    }
    .quiet {
      margin-top: 16px;
      padding: 8px;
      width: 100%;
      color: var(--tagom-green);
      text-align: center;
      font-weight: var(--fw-bold);
      font-size: 18px;
    }
  `,
})
export class KeypadOverlay {
  readonly station = inject(StationService);
  readonly digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
}
