import { Component, DestroyRef, ElementRef, inject, output, signal } from '@angular/core';
import { isDigit } from '../digit';
import { KEYPAD_LAYOUT, KeypadKey, keyAt } from './keypad-layout';

/** How long a key must be held before it starts repeating, in ms. */
export const REPEAT_DELAY = 400;
/** Time between repeats while a key is held, in ms. */
export const REPEAT_INTERVAL = 70;

/** A touch (or mouse press) in progress on a key. */
interface Press {
  readonly key: KeypadKey;
  /** Whether the key has already repeated, in which case releasing it does not type it once more. */
  repeated: boolean;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * On-screen keypad: digits and backspace.
 *
 * Touches are handled on the whole keypad rather than on each button, for speed and reliability while typing fast:
 * - The keypad is split into equal cells, so a touch anywhere in a key's cell (gaps and corners included) is on it.
 * - A key is typed when the touch is released, provided it is still on that key; sliding within the key is fine, but
 *   sliding off it cancels the press.
 * - Several fingers can press keys at once; each key is typed when its finger is released.
 * - Holding a key repeats it.
 *
 * Keys can also be typed on a physical keyboard: they are typed when pressed and repeat as the keyboard repeats them.
 * Keys being pressed, by touch or keyboard, are shown pressed. The buttons themselves still work with the keyboard and
 * assistive technology (Enter or Space on a focused key).
 */
@Component({
  selector: 'app-keypad',
  host: {
    role: 'group',
    'aria-label': 'Keypad',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'cancelPress($event.pointerId)',
    '(document:keydown)': 'onKeydown($event)',
    '(document:keyup)': 'onKeyup($event)',
    '(window:blur)': 'heldKeys.set([])',
  },
  template: `
    @for (position of keys; track position.key) {
      <button
        type="button"
        class="key"
        [class.backspace]="position.key === 'backspace'"
        [class.pressed]="isPressed(position.key)"
        [attr.data-key]="position.key"
        [attr.aria-label]="position.key === 'backspace' ? 'Delete last digit' : null"
        [style.grid-row]="position.row + 1"
        [style.grid-column]="position.column + 1"
        (click)="onClick($event, position.key)"
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

  /** Keys held down on a physical keyboard. */
  protected readonly heldKeys = signal<readonly KeypadKey[]>([]);
  /** Keys being touched. */
  protected readonly touchedKeys = signal<readonly KeypadKey[]>([]);
  /** Touches in progress, by pointer. */
  private readonly presses = new Map<number, Press>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const press of this.presses.values()) {
        clearTimeout(press.timer);
      }
    });
  }

  protected isPressed(key: KeypadKey): boolean {
    return this.heldKeys().includes(key) || this.touchedKeys().includes(key);
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    const key = this.keyAt(event);
    if (key === null) {
      return;
    }
    // No focus change, text selection or emulated mouse events: the touch is all ours.
    event.preventDefault();
    this.host.setPointerCapture(event.pointerId);
    this.cancelPress(event.pointerId);
    const press: Press = {
      key,
      repeated: false,
      timer: setTimeout(() => {
        this.repeat(event.pointerId);
      }, REPEAT_DELAY),
    };
    this.presses.set(event.pointerId, press);
    this.updateTouchedKeys();
  }

  protected onPointerMove(event: PointerEvent): void {
    const press = this.presses.get(event.pointerId);
    if (press !== undefined && this.keyAt(event) !== press.key) {
      this.cancelPress(event.pointerId);
    }
  }

  protected onPointerUp(event: PointerEvent): void {
    const press = this.presses.get(event.pointerId);
    if (press === undefined) {
      return;
    }
    this.cancelPress(event.pointerId);
    if (!press.repeated && this.keyAt(event) === press.key) {
      this.keyPressed.emit(press.key);
    }
  }

  /** Ends a touch without typing its key. */
  protected cancelPress(pointerId: number): void {
    const press = this.presses.get(pointerId);
    if (press === undefined) {
      return;
    }
    clearTimeout(press.timer);
    this.presses.delete(pointerId);
    this.updateTouchedKeys();
  }

  /** Activation of a focused button from the keyboard or assistive technology; touches and clicks are handled above. */
  protected onClick(event: MouseEvent, key: KeypadKey): void {
    if (event.detail === 0) {
      this.keyPressed.emit(key);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const key = keyFor(event);
    if (key === null) {
      return;
    }
    event.preventDefault();
    this.heldKeys.update((keys) => (keys.includes(key) ? keys : [...keys, key]));
    this.keyPressed.emit(key);
  }

  protected onKeyup(event: KeyboardEvent): void {
    const key = keyFor(event);
    if (key !== null) {
      this.heldKeys.update((keys) => keys.filter((held) => held !== key));
    }
  }

  private repeat(pointerId: number): void {
    const press = this.presses.get(pointerId);
    if (press === undefined) {
      return;
    }
    press.repeated = true;
    press.timer = setTimeout(() => {
      this.repeat(pointerId);
    }, REPEAT_INTERVAL);
    this.keyPressed.emit(press.key);
  }

  private updateTouchedKeys(): void {
    this.touchedKeys.set(Array.from(this.presses.values(), (press) => press.key));
  }

  private keyAt(event: PointerEvent): KeypadKey | null {
    return keyAt(this.host.getBoundingClientRect(), event.clientX, event.clientY);
  }
}

/** The keypad key a physical key press stands for, if any. */
function keyFor(event: KeyboardEvent): KeypadKey | null {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  if (event.key === 'Backspace') {
    return 'backspace';
  }
  return isDigit(event.key) ? event.key : null;
}
