import { NgOptimizedImage } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Background } from '../../ui/background';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { DeveloperTaps } from '../../developer-mode/developer-taps';
import { Tweaks } from '../../developer-mode/tweaks';
import { OverflowMenu } from '../../ui/overflow-menu';
import { seasonAt } from '../../game/layers/seasons';

/**
 * The main menu, where the app opens: the game's icon and name, a button to play and one above it to the player's runs,
 * with more in an overflow menu in a corner.
 */
@Component({
  selector: 'app-menu',
  imports: [NgOptimizedImage, RouterLink, DeveloperTaps, OverflowMenu],
  host: { class: 'screen' },
  template: `
    <app-overflow-menu>
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
    </app-overflow-menu>
    <div class="title">
      <!-- Tapping it ten times in a row turns developer mode on or off. -->
      <button
        #taps="developerTaps"
        appDeveloperTaps
        type="button"
        class="icon-button"
        aria-label="Slice of Pi"
      >
        <img class="icon" ngSrc="icons/icon.webp" width="136" height="136" alt="" priority />
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
    <div class="actions">
      <a class="candy" routerLink="/runs">Your Runs</a>
      <a class="candy primary" routerLink="/play">Play</a>
    </div>
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

  constructor() {
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
