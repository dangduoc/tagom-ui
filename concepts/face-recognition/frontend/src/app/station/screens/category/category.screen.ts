import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { CATEGORIES, CATEGORY_KEYS, CategoryKey, catName } from '../../core/models';
import { StationService } from '../../core/station.service';
import { IconName, TgIcon } from '../../shared/tg-icon';

const TILE_ICONS: Record<CategoryKey, IconName> = {
  nhua: 'plastic',
  giay: 'paper',
  kimloai: 'metal',
  thuytinh: 'glass',
  vai: 'fabric',
  chuaphanloai: 'unsorted',
};

/** Sorted mode only — quick mode never reaches this screen (handoff §8.5). */
@Component({
  selector: 'tg-category-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TgIcon],
  template: `
    <header>
      <h1 class="tg-display">{{ station.L().pickTitle }}</h1>
      <p>{{ station.L().pickSub }}</p>
    </header>

    <div class="grid">
      @for (tile of tiles(); track tile.key) {
        <button
          type="button"
          class="tile"
          [style.background]="tile.color"
          (click)="station.pick(tile.key)"
        >
          <tg-icon [name]="tile.icon" [size]="52" [strokeWidth]="1.7" />
          <span class="label tg-display">{{ tile.name }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      position: absolute;
      inset: 0;
      flex-direction: column;
      padding: 36px 40px;
    }
    header {
      margin-bottom: 24px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: clamp(28px, 3.4vw, 40px);
    }
    header p {
      margin: 0;
      opacity: 0.7;
      font-size: var(--text-lg);
    }
    .grid {
      display: grid;
      flex: 1;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 18px;
      min-height: 0;
    }
    .tile {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-radius: var(--radius-lg);
      box-shadow: 0 8px 20px rgb(0 0 0 / 0.12);
      padding: 28px;
      min-height: 150px;
      color: #fff;
      transition: transform var(--dur-fast) var(--ease-standard);
    }
    .tile:hover {
      transform: translateY(var(--hover-lift));
    }
    .tile:active {
      transform: scale(var(--press-scale));
    }
    .label {
      font-size: 32px;
    }
    @media (max-width: 600px) {
      :host {
        padding: 16px;
        overflow-y: auto;
      }
      .grid {
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: none;
      }
      .tile {
        padding: 20px;
        min-height: 130px;
      }
      .label {
        font-size: var(--text-h3);
      }
    }
  `,
})
export class CategoryScreen {
  readonly station = inject(StationService);

  readonly tiles = computed(() =>
    CATEGORY_KEYS.map((key) => ({
      key,
      color: CATEGORIES[key].color,
      name: catName(key, this.station.lang()),
      icon: TILE_ICONS[key],
    })),
  );
}
