import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { StationService } from '../../core/station.service';
import { QrCode } from '../../shared/qr-code';
import { TgIcon } from '../../shared/tg-icon';

/** First-timer onboarding. Skipping must feel welcoming, not punished (handoff §5.4). */
@Component({
  selector: 'tg-unknown-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QrCode, TgIcon],
  template: `
    <div class="copy">
      <h1 class="tg-display">{{ station.L().unknownTitle }}</h1>
      <p class="sub">{{ station.L().unknownSub }}</p>
      <div class="actions">
        <button type="button" class="primary" (click)="station.goRegister()">
          {{ station.L().registerHere }}
          <tg-icon name="arrow-right" [size]="28" [strokeWidth]="2.3" />
        </button>
        <button type="button" class="ghost" (click)="station.skip()">
          {{ station.L().continueAnon }}
          <tg-icon name="arrow-right" [size]="26" [strokeWidth]="2.2" />
        </button>
      </div>
      <p class="note">{{ station.L().skipNote }}</p>
    </div>

    <div class="qr-card">
      <p class="qr-title">{{ station.L().downloadApp }}</p>
      <div class="qr-box"><tg-qr payload="https://tagom.vn/app" /></div>
      <p class="qr-note">Tagom · App Store · Google Play</p>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      position: absolute;
      inset: 0;
      gap: 52px;
      align-items: center;
      justify-content: center;
      padding: 44px;
      overflow-y: auto;
    }
    .copy {
      width: 400px;
      max-width: 100%;
    }
    h1 {
      margin: 0 0 18px;
      text-wrap: pretty;
      line-height: 1.06;
      font-size: clamp(32px, 4vw, 46px);
    }
    .sub {
      margin: 0 0 36px;
      text-wrap: pretty;
      line-height: 1.4;
      font-size: 23px;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .primary,
    .ghost {
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      border-radius: 18px;
      font-weight: var(--fw-bold);
    }
    .primary {
      background: var(--tagom-green);
      padding: 22px 32px;
      color: var(--tagom-lime);
      font-size: var(--text-h3);
    }
    .ghost {
      border: 1.5px solid var(--border-strong);
      padding: 20px 32px;
      color: var(--tagom-green);
      font-size: 22px;
    }
    .note {
      margin: 18px 0 0;
      opacity: 0.6;
      line-height: 1.4;
      font-size: var(--text-body-size);
    }
    .qr-card {
      border-radius: var(--radius-xl);
      background: var(--surface-card);
      box-shadow: 0 20px 50px rgb(0 77 67 / 0.14);
      padding: 36px;
      width: 340px;
      text-align: center;
    }
    .qr-title {
      margin: 0 0 20px;
      font-weight: var(--fw-bold);
      font-size: 19px;
    }
    .qr-box {
      margin: 0 auto;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      background: var(--tagom-white);
      width: 200px;
      height: 200px;
    }
    .qr-note {
      margin: 18px 0 0;
      opacity: 0.6;
      line-height: 1.4;
      font-size: 15px;
    }
    @media (max-width: 600px) {
      :host {
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        gap: 16px;
        padding: 18px;
      }
      .qr-card {
        width: 100%;
      }
    }
  `,
})
export class UnknownScreen {
  readonly station = inject(StationService);
}
