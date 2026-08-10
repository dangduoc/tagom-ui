import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { StationService } from '../core/station.service';

@Component({
  selector: 'tg-lang-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="pills" (click)="station.toggleLang()" [attr.aria-label]="'VN / EN'">
      <span [class.on]="station.lang() === 'vn'">VN</span>
      <span [class.on]="station.lang() === 'en'">EN</span>
    </button>
  `,
  styles: `
    .pills {
      display: flex;
      gap: 2px;
      border-radius: var(--radius-pill);
      background: var(--accent);
      padding: 4px;
      user-select: none;
    }
    .pills span {
      border-radius: var(--radius-pill);
      padding: 6px 16px;
      color: rgb(255 255 255 / 0.8);
      font-size: 15px;
      font-weight: var(--fw-bold);
    }
    .pills .on {
      background: var(--surface-card);
      color: var(--tagom-green);
    }
  `,
})
export class LangToggle {
  readonly station = inject(StationService);
}
