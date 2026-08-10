import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { StationService } from './core/station.service';
import { CategoryScreen } from './screens/category/category.screen';
import { ConfirmedScreen } from './screens/confirmed/confirmed.screen';
import { FaceScreen } from './screens/face/face.screen';
import { IdentifyScreen } from './screens/identify/identify.screen';
import { IdleScreen } from './screens/idle/idle.screen';
import { LoginScreen } from './screens/login/login.screen';
import { PhoneScreen } from './screens/phone/phone.screen';
import { ProfileScreen } from './screens/profile/profile.screen';
import { RegisterScreen } from './screens/register/register.screen';
import { SummaryScreen } from './screens/summary/summary.screen';
import { UnknownScreen } from './screens/unknown/unknown.screen';
import { WeighScreen } from './screens/weigh/weigh.screen';
import { LangToggle } from './shared/lang-toggle';
import { EndSessionDialog } from './shared/overlays/endsession-dialog';
import { ErrorBanner } from './shared/overlays/error-banner';
import { HelpOverlay } from './shared/overlays/help-overlay';
import { NoFaceDialog } from './shared/overlays/noface-dialog';
import { SessionRail } from './shared/session-rail/session-rail';
import { TgIcon } from './shared/tg-icon';

/**
 * Hosts the current screen plus the shared header, the persistent rail and the
 * overlay/error layers. One state machine, no URL routing (handoff §3).
 */
@Component({
  selector: 'tg-station',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CategoryScreen,
    ConfirmedScreen,
    EndSessionDialog,
    ErrorBanner,
    FaceScreen,
    HelpOverlay,
    IdentifyScreen,
    IdleScreen,
    LangToggle,
    LoginScreen,
    NoFaceDialog,
    PhoneScreen,
    ProfileScreen,
    RegisterScreen,
    SessionRail,
    SummaryScreen,
    TgIcon,
    UnknownScreen,
    WeighScreen,
  ],
  templateUrl: './station-shell.html',
  styleUrl: './station-shell.scss',
})
export class StationShell {
  readonly station = inject(StationService);
}
