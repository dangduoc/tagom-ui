import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ScaleService } from '../../../scale/scale.service';
import { CATEGORIES, catName } from '../../core/models';
import { StationService } from '../../core/station.service';
import { TgIcon } from '../../shared/tg-icon';
import { WeightReadout } from '../../shared/weight-readout/weight-readout';

@Component({
  selector: 'tg-weigh-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TgIcon, WeightReadout],
  templateUrl: './weigh.screen.html',
  styleUrl: './weigh.screen.scss',
})
export class WeighScreen {
  readonly station = inject(StationService);
  readonly scale = inject(ScaleService);
  readonly weigh = this.station.weigh;

  readonly categoryName = computed(() => {
    const key = this.station.currentCat();
    return key ? catName(key, this.station.lang()) : '';
  });

  readonly categoryColor = computed(() => {
    const key = this.station.currentCat();
    return key ? CATEGORIES[key].color : 'var(--tagom-green)';
  });

  readonly connected = computed(() => this.scale.status() === 'connected' && !!this.scale.reading());
  readonly isLocked = computed(() => this.weigh.phase() === 'locked');
}
