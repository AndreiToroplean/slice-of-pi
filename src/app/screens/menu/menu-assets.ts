import { computed, Service, signal } from '@angular/core';

/**
 * Whether the main menu's icon and fonts have arrived, so that the menu shows up whole rather than drawing them in as
 * they come. Once they have, they stay: the menu shows at once when the player comes back to it.
 */
@Service()
export class MenuAssets {
  private readonly iconSettled = signal(false);
  private readonly fontsSettled = signal(false);

  /** Whether the menu can show: its icon has loaded (or failed to) and so have its fonts. */
  readonly ready = computed(() => this.iconSettled() && this.fontsSettled());

  /** Notes that the icon has loaded, or failed to: either way, there is nothing more to wait for. */
  iconDone(): void {
    this.iconSettled.set(true);
  }

  /** Waits for the fonts the page is loading, once the menu's text has asked for them by being laid out. */
  async waitForFonts(fonts: FontFaceSet): Promise<void> {
    await fonts.ready;
    this.fontsSettled.set(true);
  }
}
