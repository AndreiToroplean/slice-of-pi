import { inject } from '@angular/core';
import { CanDeactivateFn, Router } from '@angular/router';

/** A screen that going back in the history, as the browser's or the system's Back does, may not leave. */
export interface PausesOnBack {
  /** Whether going back may leave the screen; if not, the screen does what going back means there instead. */
  leaveOnBack(): boolean;
}

/**
 * Keeps going back in the history, as the browser's or the system's Back does, from leaving a screen that doesn't let
 * it, such as the play screen, which pauses instead. Here rather than with the screen, so that the routes needn't
 * load it.
 */
export const pauseOnBack: CanDeactivateFn<PausesOnBack> = (screen) =>
  inject(Router).currentNavigation()?.trigger !== 'popstate' || screen.leaveOnBack();
