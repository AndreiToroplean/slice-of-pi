import { NgOptimizedImage } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Background } from '../background/background';
import { seasonAt } from '../seasons/seasons';

/** The main menu, where the app opens: the game's icon and name, and a button to play. */
@Component({
  selector: 'app-menu',
  imports: [NgOptimizedImage, RouterLink],
  host: { class: 'screen' },
  template: `
    <div class="title">
      <img class="icon" ngSrc="icons/icon.svg" width="136" height="136" alt="" priority />
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

  constructor() {
    // The background of a new game, so that playing starts on the same colors.
    inject(Background).colors.set(seasonAt(0).background);
  }
}
