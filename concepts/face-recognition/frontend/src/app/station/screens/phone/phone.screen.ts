import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { StationService } from '../../core/station.service';
import { LoadingOverlay } from '../../shared/loading-overlay';
import { OptionCard } from '../../shared/option-card';

/**
 * Phone-number sign-in. Was a dialog stacked on top of the live camera feed;
 * it's now its own screen, so the keypad gets kiosk-sized keys and the camera
 * isn't running behind it.
 *
 * All the state (`keypad`, `keypadBusy`, `keypadMiss`) and the lookup live
 * in StationService — this is only the surface.
 */
@Component({
  selector: 'tg-phone-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoadingOverlay, OptionCard],
  templateUrl: './phone.screen.html',
  styleUrl: './phone.screen.scss',
})
export class PhoneScreen {
  readonly station = inject(StationService);
  readonly digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
}
