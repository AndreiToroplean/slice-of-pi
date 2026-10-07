import { Component, ElementRef, output, viewChildren } from '@angular/core';
import { Digit, isDigit } from '../digit';
import { KEYPAD_LAYOUT } from './keypad-layout';

const PRESS_KEYFRAMES: Keyframe[] = [{ transform: 'scale(0.9)' }, { transform: 'scale(1)' }];
const PRESS_TIMING: KeyframeAnimationOptions = {
  duration: 180,
  easing: 'cubic-bezier(0.3, 1.6, 0.6, 1)',
};

/**
 * On-screen digit keypad. Digits can also be typed on a physical keyboard; both go through `press()`, the single place
 * where key effects are triggered.
 */
@Component({
  selector: 'app-keypad',
  host: {
    role: 'group',
    'aria-label': 'Digit keypad',
    '(document:keydown)': 'onKeydown($event)',
  },
  template: `
    @for (key of keys; track key.digit) {
      <button
        #keyButton
        type="button"
        class="key"
        [attr.data-digit]="key.digit"
        [style.grid-row]="key.row + 1"
        [style.grid-column]="key.column + 1"
        (click)="press(key.digit)"
      >
        {{ key.digit }}
      </button>
    }
  `,
  styleUrl: './keypad.css',
})
export class Keypad {
  readonly digitPressed = output<Digit>();

  protected readonly keys = KEYPAD_LAYOUT;

  private readonly keyButtons = viewChildren<ElementRef<HTMLButtonElement>>('keyButton');

  protected press(digit: Digit): void {
    this.keyButton(digit)?.animate(PRESS_KEYFRAMES, PRESS_TIMING);
    this.digitPressed.emit(digit);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !isDigit(event.key)) {
      return;
    }
    event.preventDefault();
    this.press(event.key);
  }

  private keyButton(digit: Digit): HTMLButtonElement | undefined {
    return this.keyButtons()
      .map((ref) => ref.nativeElement)
      .find((button) => button.dataset['digit'] === digit);
  }
}
