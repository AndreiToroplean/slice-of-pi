import { NgOptimizedImage } from '@angular/common';
import { Component, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Background } from '../background/background';
import { DeveloperGesture } from '../developer/developer-gesture';
import { DeveloperMode } from '../developer/developer-mode';
import { DeveloperOverlay } from '../developer/developer-overlay';
import { Tweaks } from '../developer/tweaks';
import { seasonAt } from '../seasons/seasons';

/**
 * The main menu, where the app opens: the game's icon and name and a button to play, with more in an overflow menu in a
 * corner.
 */
@Component({
  selector: 'app-menu',
  imports: [NgOptimizedImage, RouterLink, DeveloperGesture, DeveloperOverlay],
  host: { class: 'screen' },
  template: `
    <!-- Holding it opens developer mode's secret gesture. -->
    <app-developer-overlay [gesture]="gesture" />
    <button
      #more
      #gesture="developerGesture"
      appDeveloperGesture
      type="button"
      class="frosted more"
      aria-label="More"
      popovertarget="more-menu"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="5.5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="18.5" r="2" />
      </svg>
    </button>
    <!-- A simple dropdown under the button: the browser closes it on a tap outside or on Escape. -->
    <nav
      id="more-menu"
      class="dropdown"
      popover
      aria-label="More"
      [style.top.px]="dropdownAt().top"
      [style.right.px]="dropdownAt().right"
      (beforetoggle)="placeDropdown()"
    >
      <a routerLink="/runs">Your runs</a>
      <a routerLink="/data">Your data</a>
      @if (developerMode.enabled()) {
        <div class="section" role="group" aria-labelledby="developer-title">
          <h2 id="developer-title">Developer</h2>
          <a routerLink="/developer/key-colors">Key colors</a>
          <a routerLink="/developer/season-colors">Season colors</a>
          <label class="toggle">
            <input type="checkbox" [checked]="tweaks.checking()" (change)="setChecking($event)" />
            Check digits
          </label>
        </div>
      }
    </nav>
    <div class="title">
      <img class="icon" ngSrc="icons/icon.webp" width="136" height="136" alt="" priority />
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
    <div class="actions">
      <a class="candy primary" routerLink="/play">Play</a>
    </div>
  `,
  styleUrl: './menu.css',
})
export class Menu {
  protected readonly name = 'Slice of Pi';
  /** The name's words, line by line: "Pi" stands on its own line, bigger. */
  protected readonly lines = [['Slice', 'of'], ['Pi']];
  /** Where the dropdown opens, from the top right corner of the window, just under its button. */
  protected readonly dropdownAt = signal({ top: 0, right: 0 });
  protected readonly developerMode = inject(DeveloperMode);

  /** The values tuned in developer mode, checking the digits among them. */
  protected readonly tweaks = inject(Tweaks);

  private readonly more = viewChild.required<ElementRef<HTMLButtonElement>>('more');

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

  /** Puts the dropdown under its button. It opens in the top layer, positioned against the window. */
  protected placeDropdown(): void {
    const button = this.more().nativeElement.getBoundingClientRect();
    this.dropdownAt.set({
      top: button.bottom + 6,
      right: document.documentElement.clientWidth - button.right,
    });
  }
}
