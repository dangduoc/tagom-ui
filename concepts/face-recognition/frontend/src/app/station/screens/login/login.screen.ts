import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { StationService } from '../../core/station.service';
import { OptionCard } from '../../shared/option-card';

/**
 * "Chọn hình thức đăng nhập" — the three ways in, chosen before anything starts.
 * Nothing here touches the camera: it only begins once Face ID is picked.
 *
 * There is deliberately no "weigh anonymously" escape here: signing in one of
 * these three ways is now the only way through. `StationService.skip()` still
 * exists and still works, it just has no button on this screen.
 */
@Component({
  selector: 'tg-login-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OptionCard],
  templateUrl: './login.screen.html',
  styleUrl: './login.screen.scss',
})
export class LoginScreen {
  readonly station = inject(StationService);
}
