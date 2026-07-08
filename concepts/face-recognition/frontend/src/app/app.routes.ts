import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'live', loadComponent: () => import('./live/live.page').then((m) => m.LivePage) },
  { path: 'enroll', loadComponent: () => import('./enroll/enroll.page').then((m) => m.EnrollPage) },
  { path: '', redirectTo: 'live', pathMatch: 'full' },
  { path: '**', redirectTo: 'live' },
];
