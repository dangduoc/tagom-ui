import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { CATEGORIES, catName, fmtTotal, fmtWeight, sessionTotal } from '../../core/models';
import { StationService } from '../../core/station.service';
import { TgIcon } from '../../shared/tg-icon';

/** Account holders only — never reachable for `anon` (handoff §8.6). */
@Component({
  selector: 'tg-profile-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TgIcon],
  templateUrl: './profile.screen.html',
  styleUrl: './profile.screen.scss',
})
export class ProfileScreen {
  readonly station = inject(StationService);

  readonly rows = computed(() => {
    const L = this.station.L();
    const p = this.station.account();
    const dash = '—';
    if (!p) return [];
    return [
      { label: L.fFullName, value: p.fullName || dash },
      { label: L.fPhone, value: p.phone || dash },
      {
        label: L.fAge,
        value: p.age ? `${p.age}${this.station.lang() === 'vn' ? ' tuổi' : ''}` : dash,
      },
      { label: L.fCitizenId, value: p.citizenId || dash },
      {
        label: L.fAddress,
        value: [p.address, p.ward, p.city].filter(Boolean).join(', ') || dash,
      },
    ];
  });

  readonly history = computed(() =>
    this.station.sessions().map((s, index) => ({
      id: `${s.date}-${index}`,
      date: s.date,
      totalText: fmtWeight(sessionTotal(s)),
      chips: s.items.map((item, i) => ({
        id: i,
        name: catName(item.key, this.station.lang()),
        color: CATEGORIES[item.key].color,
        weightText: fmtWeight(item.weight),
      })),
    })),
  );

  /** Lifetime total is the server's, not a sum of the history shown here. */
  readonly lifetimeText = computed(() =>
    fmtTotal(this.station.personalTotal(), this.station.lang()),
  );

  field(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
