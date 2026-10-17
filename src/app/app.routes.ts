import { Routes } from '@angular/router';
import { missingPreview } from './screens/missing-preview/missing-preview-path';
import { Menu } from './screens/menu/menu';

export const routes: Routes = [
  {
    path: '',
    // Where the app opens: loaded with the app rather than after it, so that it can show at once.
    component: Menu,
  },
  {
    path: 'play',
    loadComponent: () => import('./screens/play/play').then((m) => m.Play),
  },
  {
    path: 'runs',
    loadComponent: () => import('./screens/your-runs/your-runs').then((m) => m.YourRuns),
  },
  {
    path: 'data',
    loadComponent: () => import('./screens/your-data/data').then((m) => m.Data),
  },
  {
    path: 'developer/key-colors',
    loadComponent: () => import('./screens/tuning/key-colors').then((m) => m.KeyColors),
  },
  {
    path: 'developer/season-colors',
    loadComponent: () => import('./screens/tuning/season-colors').then((m) => m.SeasonColors),
  },
  {
    matcher: missingPreview,
    loadComponent: () =>
      import('./screens/missing-preview/missing-preview').then((m) => m.MissingPreview),
  },
  { path: '**', redirectTo: '' },
];
