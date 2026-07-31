import { Routes } from '@angular/router';

/** The station itself is a single state machine, not URL-routed (handoff §3).
 *  Routing exists only to keep the original hardware test pages reachable. */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./station/station-shell').then((m) => m.StationShell),
  },
  {
    path: 'debug',
    loadComponent: () => import('./debug/debug-shell').then((m) => m.DebugShell),
    children: [
      { path: 'live', loadComponent: () => import('./live/live.page').then((m) => m.LivePage) },
      {
        path: 'enroll',
        loadComponent: () => import('./enroll/enroll.page').then((m) => m.EnrollPage),
      },
      { path: 'scale', loadComponent: () => import('./scale/scale.page').then((m) => m.ScalePage) },
      { path: '', redirectTo: 'scale', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
