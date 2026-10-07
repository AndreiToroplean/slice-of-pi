import { Component, signal } from '@angular/core';
import { DigitTape } from '../digit-tape/digit-tape';
import { Keypad } from '../keypad/keypad';
import { KeypadKey } from '../keypad/keypad-layout';

/** The play screen: type digits on the keypad (or delete them) and watch them line up on the tape. */
@Component({
  selector: 'app-play',
  imports: [DigitTape, Keypad],
  template: `
    <h1 class="visually-hidden">Slice of π</h1>
    <app-digit-tape class="tape" [digits]="digits()" />
    <app-keypad class="keypad" (keyPressed)="press($event)" />
  `,
  styleUrl: './play.css',
})
export class Play {
  /** Everything typed so far: one character per digit, so even a very long sequence takes little memory. */
  protected readonly digits = signal('');

  protected press(key: KeypadKey): void {
    this.digits.update((digits) => (key === 'backspace' ? digits.slice(0, -1) : digits + key));
  }
}
