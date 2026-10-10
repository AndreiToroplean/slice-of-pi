import { Component, computed, effect, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { DigitTape } from '../digit-tape/digit-tape';
import { Keypad } from '../keypad/keypad';
import { KeypadKey } from '../keypad/keypad-layout';
import { SeasonHeader } from '../season-header/season-header';
import { seasonAt } from '../seasons/seasons';

/** The play screen: type digits on the keypad (or delete them) and watch them line up on the tape, as the seasons go by. */
@Component({
  selector: 'app-play',
  imports: [DigitTape, Keypad, SeasonHeader],
  host: {
    '[style.--background-top]': 'season().background[0]',
    '[style.--background-bottom]': 'season().background[1]',
  },
  template: `
    <h1 class="visually-hidden">Slice of π</h1>
    <app-season-header [view]="season()" />
    <app-digit-tape class="tape" [digits]="digits()" />
    <app-keypad class="keypad" (keyPressed)="press($event)" />
  `,
  styleUrl: './play.css',
})
export class Play {
  /** Everything typed so far: one character per digit, so even a very long sequence takes little memory. */
  protected readonly digits = signal('');

  /** The season, and the background colors, after the places typed so far. */
  protected readonly season = computed(() => seasonAt(this.digits().length));

  constructor() {
    const meta = inject(Meta);
    // The browser's bars around the game blend into the top of the background.
    effect(() => {
      meta.updateTag({ name: 'theme-color', content: this.season().background[0] });
    });
  }

  protected press(key: KeypadKey): void {
    this.digits.update((digits) => (key === 'backspace' ? digits.slice(0, -1) : digits + key));
  }
}
