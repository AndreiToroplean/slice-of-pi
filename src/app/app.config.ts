import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, ViewTransitionInfo, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withViewTransitions({ onViewTransitionCreated: zoom })),
  ],
};

/** Zooms in, through the main menu, into a game starting, and back out when it ends (see `styles.css`). */
export function zoom({ transition, to }: ViewTransitionInfo): void {
  // Older browsers have view transitions without types: they cross-fade only.
  (transition.types as ViewTransitionTypeSet | undefined)?.add(
    to.firstChild?.routeConfig?.path === 'play' ? 'zoom-in' : 'zoom-out',
  );
}
