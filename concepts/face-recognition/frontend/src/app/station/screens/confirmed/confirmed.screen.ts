import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { StationService } from '../../core/station.service';
import { TgIcon } from '../../shared/tg-icon';

@Component({
  selector: 'tg-confirmed-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TgIcon],
  template: `
    <div class="card">
      <span class="avatar"><tg-icon name="user" [size]="52" /></span>
      <p class="hi">{{ station.L().confirmedHi }}</p>
      <p class="name tg-display">{{ station.idName() }}</p>
      <p class="phone">
        <tg-icon name="phone" [size]="24" [strokeWidth]="1.8" />
        {{ station.idPhone() }}
      </p>
      <p class="question">{{ station.L().confirmedQ }}</p>
      <div class="actions">
        <button type="button" class="yes" (click)="station.start()">{{ station.L().yes }}</button>
        <button type="button" class="no" (click)="station.notMe()">{{ station.L().notMe }}</button>
      </div>
      <button type="button" class="profile-link" (click)="station.openProfile()">
        {{ station.L().viewProfile }}
      </button>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      position: absolute;
      inset: 0;
      align-items: center;
      justify-content: center;
      padding: 44px;
      overflow-y: auto;
    }
    .card {
      border-radius: var(--radius-xl);
      background: var(--surface-card);
      box-shadow: 0 20px 50px rgb(0 77 67 / 0.14);
      padding: 56px;
      width: 640px;
      max-width: 100%;
      text-align: center;
      animation: tg-rise var(--dur-slow) var(--ease-out);
    }
    .avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      border-radius: var(--radius-circle);
      background: var(--lime-100);
      width: 96px;
      height: 96px;
      color: var(--tagom-green);
    }
    .hi {
      margin: 0 0 4px;
      opacity: 0.6;
      font-size: 22px;
    }
    .name {
      margin: 0 0 28px;
      font-size: 52px;
    }
    .phone {
      display: inline-flex;
      gap: 12px;
      align-items: center;
      margin: 0 0 36px;
      border-radius: var(--radius-md);
      background: var(--surface-sunken);
      padding: 16px 26px;
      letter-spacing: 0.02em;
      font-weight: var(--fw-semibold);
      font-size: 26px;
    }
    .question {
      margin: 0 0 24px;
      font-weight: var(--fw-bold);
      font-size: 26px;
    }
    .actions {
      display: flex;
      gap: 16px;
      justify-content: center;
    }
    .yes,
    .no {
      flex: 1;
      max-width: 280px;
      border-radius: var(--radius-pill);
      padding: 22px;
      font-weight: var(--fw-bold);
    }
    .yes {
      background: var(--tagom-green);
      color: var(--tagom-lime);
      letter-spacing: 0.03em;
      font-size: var(--text-h3);
      text-transform: uppercase;
    }
    .no {
      border: 1.5px solid var(--border-strong);
      color: var(--tagom-green);
      font-size: 22px;
    }
    .profile-link {
      margin-top: 20px;
      color: var(--tagom-green);
      font-weight: var(--fw-bold);
      font-size: 19px;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    @media (max-width: 600px) {
      .card {
        padding: 32px 26px;
      }
      .name {
        font-size: 38px;
      }
      .actions {
        flex-direction: column;
      }
      .yes,
      .no {
        max-width: none;
      }
    }
  `,
})
export class ConfirmedScreen {
  readonly station = inject(StationService);
}
