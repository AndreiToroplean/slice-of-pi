import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, ViewTransitionInfo, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withViewTransitions({ onViewTransitionCreated: zoom })),
  ],
};

/**
 * Zooms in, through the main menu, into the screen opening over it, such as a game starting, and back out to the main
 * menu (see `styles.css`).
 */
export function zoom({ transition, to }: ViewTransitionInfo): void {
  // Older browsers have view transitions without types: they cross-fade only.
  (transition.types as ViewTransitionTypeSet | undefined)?.add(
    to.firstChild?.routeConfig?.path === '' ? 'zoom-out' : 'zoom-in',
  );
}
