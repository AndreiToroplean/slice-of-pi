import { Routes } from '@angular/router';
import { missingPreview } from './preview/missing-preview-path';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./menu/menu').then((m) => m.Menu),
  },
  {
    path: 'play',
    loadComponent: () => import('./play/play').then((m) => m.Play),
  },
  {
    path: 'runs',
    loadComponent: () => import('./data/your-runs').then((m) => m.YourRuns),
  },
  {
    path: 'data',
    loadComponent: () => import('./data/data').then((m) => m.Data),
  },
  {
    path: 'developer/key-colors',
    loadComponent: () => import('./developer/key-colors').then((m) => m.KeyColors),
  },
  {
    path: 'developer/season-colors',
    loadComponent: () => import('./developer/season-colors').then((m) => m.SeasonColors),
  },
  {
    matcher: missingPreview,
    loadComponent: () => import('./preview/missing-preview').then((m) => m.MissingPreview),
  },
  { path: '**', redirectTo: '' },
];
