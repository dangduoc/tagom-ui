import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { StationService } from '../../core/station.service';
import { LangToggle } from '../../shared/lang-toggle';
import { TgIcon } from '../../shared/tg-icon';

@Component({
  selector: 'tg-idle-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LangToggle, TgIcon],
  templateUrl: './idle.screen.html',
  styleUrl: './idle.screen.scss',
})
export class IdleScreen {
  readonly station = inject(StationService);
}
