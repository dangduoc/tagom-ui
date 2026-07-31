import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { CATEGORIES, catName, fmtTotal, fmtWeight } from '../../core/models';
import { StationService } from '../../core/station.service';
import { QrCode } from '../../shared/qr-code';
import { TgIcon } from '../../shared/tg-icon';

/** The gratitude summary — the entire reward is meaning, not points (handoff §1.2). */
@Component({
  selector: 'tg-summary-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QrCode, TgIcon],
  templateUrl: './summary.screen.html',
  styleUrl: './summary.screen.scss',
})
export class SummaryScreen {
  readonly station = inject(StationService);

  readonly rows = computed(() =>
    this.station.items().map((item) => ({
      id: item.id,
      name: catName(item.key, this.station.lang()),
      color: CATEGORIES[item.key].color,
      weightText: fmtWeight(item.weight),
    })),
  );

  readonly sessionTotalText = computed(() => fmtWeight(this.station.sessionTotal()));

  readonly saveLine = computed(() => {
    const L = this.station.L();
    return this.station.isAnon() ? L.savedAnon : `${L.savedFor} ${this.station.idName()}`;
  });

  readonly personalTotalText = computed(() =>
    fmtTotal(this.station.personalTotal(), this.station.lang()),
  );

  readonly communityTotalText = computed(() =>
    fmtTotal(this.station.communityTotal(), this.station.lang()),
  );

  readonly communityPct = computed(() => {
    const goal = this.station.communityGoal();
    return goal > 0 ? Math.min(100, (this.station.communityTotal() / goal) * 100) : 0;
  });
}
