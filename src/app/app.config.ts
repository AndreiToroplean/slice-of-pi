import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideRouter,
  ViewTransitionInfo,
  withNavigationErrorHandler,
  withRouterConfig,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import { loadFailedPage } from './failed-navigation';
import { loadPlayerData } from './player-data/load-player-data';
import { ScreenTransitions } from './ui/screen-transitions';

/** Going back cancelled, as from the play screen, which pauses instead, leaves the history as it was. */
export const KEEP_HISTORY = withRouterConfig({ canceledNavigationResolution: 'computed' });

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(loadPlayerData),
    provideRouter(
      routes,
      withViewTransitions({
        onViewTransitionCreated: (info) => {
          zoom(info);
          inject(ScreenTransitions).began(info.transition.finished);
        },
      }),
      withNavigationErrorHandler(loadFailedPage),
      KEEP_HISTORY,
    ),
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
