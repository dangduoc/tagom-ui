import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { StationService } from '../../core/station.service';
import { CATEGORIES, catName, fmtWeight } from '../../core/models';
import { TgIcon } from '../tg-icon';

/** The persistent session rail — ONE component shared by the category and weigh
 *  screens, pinned in the same place on both (handoff §5.9, §8.4). On mobile it
 *  docks to the bottom as a compact total + Finish bar. */
@Component({
  selector: 'tg-session-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TgIcon],
  templateUrl: './session-rail.html',
  styleUrl: './session-rail.scss',
})
export class SessionRail {
  readonly station = inject(StationService);

  readonly rows = computed(() =>
    this.station.items().map((item) => ({
      id: item.id,
      name: catName(item.key, this.station.lang()),
      color: CATEGORIES[item.key].color,
      weightText: fmtWeight(item.weight),
    })),
  );

  readonly totalText = computed(() => fmtWeight(this.station.sessionTotal()));
}
