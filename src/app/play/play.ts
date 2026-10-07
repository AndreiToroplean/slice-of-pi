import { Component, signal } from '@angular/core';
import { Digit } from '../digit';
import { DigitTape, TAPE_CAPACITY } from '../digit-tape/digit-tape';
import { appendDigit, EMPTY_TAPE } from '../digit-tape/tape';
import { Keypad } from '../keypad/keypad';

/** The play screen: type digits on the keypad and watch them line up on the tape. */
@Component({
  selector: 'app-play',
  imports: [DigitTape, Keypad],
  template: `
    <h1 class="visually-hidden">Slice of π</h1>
    <app-digit-tape class="tape" [tape]="tape()" />
    <app-keypad class="keypad" (digitPressed)="type($event)" />
  `,
  styleUrl: './play.css',
})
export class Play {
  protected readonly tape = signal(EMPTY_TAPE);

  protected type(digit: Digit): void {
    this.tape.update((tape) => appendDigit(tape, digit, TAPE_CAPACITY));
  }
}
