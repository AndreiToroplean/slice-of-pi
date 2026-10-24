import { NgOptimizedImage } from '@angular/common';
import { afterNextRender, Component, DOCUMENT, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Background } from '../../ui/background';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { DeveloperTaps } from '../../developer-mode/developer-taps';
import { Tweaks } from '../../developer-mode/tweaks';
import { DropdownMenu } from '../../ui/dropdown-menu';
import { seasonAt } from '../../game/layers/seasons';
import { MenuAssets } from './menu-assets';
import { ButtonList } from '../../ui/button-list';

/**
 * The main menu, where the app opens: the game's icon and name, a button to play and one above it to the player's runs,
 * with more in an overflow menu in a corner, and the settings behind a gear in the other. It shows once its icon and fonts have arrived, over the background alone
 * until then.
 */
@Component({
  selector: 'app-menu',
  imports: [NgOptimizedImage, RouterLink, ButtonList, DeveloperTaps, DropdownMenu],
  host: { class: 'screen', '[class.loading]': '!assets.ready()' },
  template: `
    <a class="frosted settings" routerLink="/settings" aria-label="Settings">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
    </a>
    <app-dropdown-menu>
      <a routerLink="/data">Your Data</a>
      @if (developerMode.enabled()) {
        <div class="section" role="group" aria-labelledby="developer-title">
          <h2 id="developer-title">Developer</h2>
          <a routerLink="/developer/key-colors">Key Colors</a>
          <a routerLink="/developer/season-colors">Season Colors</a>
          <label class="toggle">
            <input type="checkbox" [checked]="tweaks.checking()" (change)="setChecking($event)" />
            Check Digits
          </label>
        </div>
      }
    </app-dropdown-menu>
    <div class="title">
      <!-- Tapping it ten times in a row turns developer mode on or off. -->
      <button
        #taps="developerTaps"
        appDeveloperTaps
        type="button"
        class="icon-button"
        aria-label="Slice of Pi"
      >
        <img
          class="icon"
          ngSrc="icons/icon.webp"
          width="136"
          height="136"
          alt=""
          priority
          (load)="assets.iconDone()"
          (error)="assets.iconDone()"
        />
      </button>
      <h1>
        <span class="visually-hidden">{{ name }}</span>
        <!-- The name written in tiles, like the typed digits. -->
        <span class="lines" aria-hidden="true">
          @for (line of lines; track $index) {
            <span class="line">
              @for (word of line; track $index) {
                <span class="word">
                  @for (letter of word; track $index) {
                    <span class="tile">{{ letter }}</span>
                  }
                </span>
              }
            </span>
          }
        </span>
      </h1>
    </div>
    <p class="developer-message" role="status" [class.shown]="taps.shown()">
      {{ taps.message() }}
    </p>
    <app-button-list class="actions">
      <a class="candy" routerLink="/runs">Your Runs</a>
      <a class="candy primary" routerLink="/play">Play</a>
    </app-button-list>
  `,
  styleUrl: './menu.css',
})
export class Menu {
  protected readonly name = 'Slice of Pi';
  /** The name's words, line by line: "Pi" stands on its own line, bigger. */
  protected readonly lines = [['Slice', 'of'], ['Pi']];
  protected readonly developerMode = inject(DeveloperMode);

  /** The values tuned in developer mode, checking the digits among them. */
  protected readonly tweaks = inject(Tweaks);
  protected readonly assets = inject(MenuAssets);

  constructor() {
    const fonts = inject(DOCUMENT).fonts;
    afterNextRender(() => void this.assets.waitForFonts(fonts));

    // The background of a new game, so that playing starts on the same colors.
    const background = inject(Background);
    effect(() => {
      background.colors.set(
        seasonAt(0, this.tweaks.seasonBackgrounds(), this.tweaks.colorSpace()).background,
      );
    });
  }

  /** Turns checking the digits on or off, from developer mode. */
  protected setChecking(event: Event): void {
    void this.tweaks.setChecking((event.target as HTMLInputElement).checked);
  }
}
