import { effect, inject, Service, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { BackgroundColors, seasonAt } from '../seasons/seasons';

/**
 * The season background behind every screen (see `App`). It stays in place from screen to screen; each screen only
 * sets its colors, which the background eases towards.
 */
@Service()
export class Background {
  /** The background's colors, top then bottom: a new game's by default. */
  readonly colors = signal<BackgroundColors>(seasonAt(0).background);

  constructor() {
    const meta = inject(Meta);
    // The browser's bars around the game blend into the top of the background.
    effect(() => {
      meta.updateTag({ name: 'theme-color', content: this.colors()[0] });
    });
  }
}
