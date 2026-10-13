import { DOCUMENT, Location } from '@angular/common';
import { inject, InjectionToken } from '@angular/core';
import { NavigationError, Router } from '@angular/router';

/** Loads a page from the server, leaving the app as it is now. */
export const LOAD_PAGE = new InjectionToken<(url: string) => void>('LOAD_PAGE', {
  factory: () => {
    const document = inject(DOCUMENT);
    return (url) => {
      document.location.assign(url);
    };
  },
});

/**
 * Loads the page a screen failed to open on afresh, from the server. A game left open across a new release still asks
 * for the code of the screens it hasn't opened yet under its old names, which the release replaced: the screen can't
 * open, and the tap would do nothing. Loading the page gets the new release whole. Only after the first screen opened,
 * so that a screen that never opens doesn't reload the page over and over.
 */
export function loadFailedPage(error: NavigationError): void {
  if (inject(Router).navigated) {
    inject(LOAD_PAGE)(inject(Location).prepareExternalUrl(error.url));
  }
}
