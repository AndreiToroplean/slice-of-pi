import { Component, ElementRef, output, viewChildren } from '@angular/core';
import { isDigit } from '../digit';
import { KEYPAD_LAYOUT, KeypadKey } from './keypad-layout';

const PRESS_KEYFRAMES: Keyframe[] = [{ transform: 'scale(0.9)' }, { transform: 'scale(1)' }];
const PRESS_TIMING: KeyframeAnimationOptions = {
  duration: 180,
  easing: 'cubic-bezier(0.3, 1.6, 0.6, 1)',
};

/**
 * On-screen keypad: digits and backspace. They can also be typed on a physical keyboard; both go through `press()`,
 * the single place where key effects are triggered.
 */
@Component({
  selector: 'app-keypad',
  host: {
    role: 'group',
    'aria-label': 'Keypad',
    '(document:keydown)': 'onKeydown($event)',
  },
  template: `
    @for (position of keys; track position.key) {
      <button
        #keyButton
        type="button"
        class="key"
        [class.backspace]="position.key === 'backspace'"
        [attr.data-key]="position.key"
        [attr.aria-label]="position.key === 'backspace' ? 'Delete last digit' : null"
        [style.grid-row]="position.row + 1"
        [style.grid-column]="position.column + 1"
        (click)="press(position.key)"
      >
        @if (position.key === 'backspace') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8.5 5h11a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-11L3 12z" />
            <path d="m11 9 6 6m0-6-6 6" />
          </svg>
        } @else {
          {{ position.key }}
        }
      </button>
    }
  `,
  styleUrl: './keypad.css',
})
export class Keypad {
  readonly keyPressed = output<KeypadKey>();

  protected readonly keys = KEYPAD_LAYOUT;

  private readonly keyButtons = viewChildren<ElementRef<HTMLButtonElement>>('keyButton');

  protected press(key: KeypadKey): void {
    this.keyButton(key)?.animate(PRESS_KEYFRAMES, PRESS_TIMING);
    this.keyPressed.emit(key);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const key = keyFor(event);
    if (key !== null) {
      event.preventDefault();
      this.press(key);
    }
  }

  private keyButton(key: KeypadKey): HTMLButtonElement | undefined {
    return this.keyButtons()
      .map((ref) => ref.nativeElement)
      .find((button) => button.dataset['key'] === key);
  }
}

/** The keypad key a physical key press stands for, if any. Holding backspace keeps deleting; holding a digit does not. */
function keyFor(event: KeyboardEvent): KeypadKey | null {
  if (event.key === 'Backspace') {
    return 'backspace';
  }
  return !event.repeat && isDigit(event.key) ? event.key : null;
}
