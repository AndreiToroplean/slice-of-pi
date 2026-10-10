import { Location } from '@angular/common';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Gives a function that goes back to the main menu from the screen over it. The history holds at most the main menu
 * and one screen over it, so that going back from that screen leads to the main menu, and from the main menu out of the
 * app: when the screen was opened from the main menu, this goes back to it, and otherwise the main menu takes the
 * screen's place.
 */
export function injectBackToMenu(): () => void {
  const router = inject(Router);
  const location = inject(Location);
  return () => {
    const previous = router.lastSuccessfulNavigation()?.previousNavigation;
    if (previous?.finalUrl?.toString() === '/') {
      location.back();
    } else {
      void router.navigateByUrl('/', { replaceUrl: true });
    }
  };
}
