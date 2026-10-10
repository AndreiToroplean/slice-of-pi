import { Routes } from '@angular/router';

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
    path: 'data',
    loadComponent: () => import('./data/data').then((m) => m.Data),
  },
  { path: '**', redirectTo: '' },
];
