import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { StationService } from '../../core/station.service';
import { Phase, fmtWeight } from '../../core/models';
import { TgIcon } from '../tg-icon';

/**
 * The hero number, owning all three phases so the flip stays consistent:
 *  settling — big muted grey-green number, jittering, amber "Settling…" chip
 *  stable   — snaps to solid green + "keep it still" + ~2s hold bar
 *  locked   — the whole panel flips to a green field with a lime number
 *
 * That flip is the emotional payoff of the app (handoff §5.8) — keep it
 * unmistakable if you touch this.
 */
@Component({
  selector: 'tg-weight-readout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TgIcon],
  templateUrl: './weight-readout.html',
  styleUrl: './weight-readout.scss',
  host: { '[class]': 'phase()' },
})
export class WeightReadout {
  readonly station = inject(StationService);

  readonly phase = input.required<Phase>();
  readonly value = input.required<number>();
  readonly holdPct = input(0);
  readonly categoryName = input('');
  /** False while the scale has no live reading — shows a waiting hint instead. */
  readonly connected = input(true);

  readonly weightText = computed(() => fmtWeight(this.value()));
  readonly isSettling = computed(() => this.phase() === 'settling');
  readonly isStable = computed(() => this.phase() === 'stable');
  readonly isLocked = computed(() => this.phase() === 'locked');
}
