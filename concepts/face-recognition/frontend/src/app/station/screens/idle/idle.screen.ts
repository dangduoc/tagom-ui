import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';

import { StationService } from '../../core/station.service';
import { LangToggle } from '../../shared/lang-toggle';
import { IDLE_SLIDES, SLIDE_MS } from './slides';

/**
 * The attract screen: a rotating poster with the station's details underneath.
 *
 * A tap anywhere starts a session — there is no button to find and nothing to
 * decide yet. Weighing always begins in sorted mode, so the person picks a
 * material on the category grid rather than choosing a mode up front.
 */
@Component({
  selector: 'tg-idle-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LangToggle],
  templateUrl: './idle.screen.html',
  styleUrl: './idle.screen.scss',
  host: {
    role: 'button',
    tabindex: '0',
    '[attr.aria-label]': 'station.L().idleTitle',
    '(click)': 'station.startSorted()',
    '(keydown.enter)': 'station.startSorted()',
    '(keydown.space)': 'station.startSorted()',
  },
})
export class IdleScreen implements OnDestroy {
  readonly station = inject(StationService);

  readonly slides = IDLE_SLIDES;
  readonly index = signal(0);
  readonly current = computed(() => this.slides[this.index()]);

  private readonly timer = setInterval(() => {
    this.index.update((i) => (i + 1) % this.slides.length);
  }, SLIDE_MS);

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
