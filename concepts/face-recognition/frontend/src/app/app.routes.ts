import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'live', loadComponent: () => import('./live/live').then((m) => m.Live) },
  { path: 'enroll', loadComponent: () => import('./enroll/enroll').then((m) => m.Enroll) },
  { path: '', redirectTo: 'live', pathMatch: 'full' },
  { path: '**', redirectTo: 'live' },
];
