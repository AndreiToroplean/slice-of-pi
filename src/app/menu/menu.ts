import { NgOptimizedImage } from '@angular/common';
import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Background } from '../background/background';
import { seasonAt } from '../seasons/seasons';

/**
 * The main menu, where the app opens: the game's icon and name and a button to play, with more in an overflow menu in a
 * corner.
 */
@Component({
  selector: 'app-menu',
  imports: [NgOptimizedImage, RouterLink],
  host: { class: 'screen' },
  template: `
    <button #more type="button" class="frosted more" aria-label="More" popovertarget="more-menu">
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
      <a routerLink="/data">Your data</a>
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

  private readonly more = viewChild.required<ElementRef<HTMLButtonElement>>('more');

  constructor() {
    // The background of a new game, so that playing starts on the same colors.
    inject(Background).colors.set(seasonAt(0).background);
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
