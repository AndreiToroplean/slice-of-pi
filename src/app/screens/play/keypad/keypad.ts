import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Digit, isDigit } from '../../../game/pi/digit';
import {
  DEFAULT_KEYPAD_LAYOUT,
  KEY_POSITIONS,
  KeypadKey,
  KeypadLayout,
  KeypadPoint,
  KeypadTouch,
  keyAt,
  pointAt,
} from '../../../game/layers/keypad-layout';
import { Candy } from '../../../ui/candy';

/** How long a key must be held before it starts repeating, in ms. */
export const REPEAT_DELAY = 400;
/** Time between repeats while a key is held, in ms. */
export const REPEAT_INTERVAL = 70;
/** How long a digit key stays filled with its color at least, however short the press, in ms. */
export const SPLASH_DURATION = 150;

/** A touch shown on the keypad, as a mark where it was, fading away. */
export interface KeypadMark extends KeypadPoint {
  /** Tells it from the other marks. */
  readonly id: number;
  /** Whether it typed a key, rather than nothing. */
  readonly typed: boolean;
  /** How far it has faded away, from 0, just touched, to 1, gone. */
  readonly faded: number;
}

/** A touch (or mouse press) in progress on the keypad. */
interface Press {
  /** The key it landed on, if any. */
  readonly key: KeypadKey | null;
  /** Whether it slid off its key, in which case releasing it types nothing. */
  slid: boolean;
  /** Whether the key has already repeated, in which case releasing it does not type it once more. */
  repeated: boolean;
  /** Where it is. */
  point: KeypadPoint;
  /** Pending repeat, for backspace only. */
  timer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * On-screen keypad: digits and backspace, in the layout given.
 *
 * Touches are handled on the whole keypad rather than on each button, for speed and reliability while typing fast:
 * - The keys' grid is split into cells, halfway between the keys, so a touch anywhere in a key's cell (gaps and corners
 *   included) is on it.
 * - The keys on the grid's edges reach out over the rest of the keypad, around the grid, as far as it goes, so that
 *   they're easy to hit; whoever lays it out gives it its room with its padding, which can reach over what's around.
 * - A key is typed when the touch is released, provided it is still on that key; sliding within the key is fine, but
 *   sliding off it cancels the press.
 * - Several fingers can press keys at once; each key is typed when its finger is released.
 * - Holding backspace repeats it; digits don't repeat.
 *
 * Keys can also be typed on a physical keyboard: they are typed when pressed, and backspace repeats as the keyboard
 * repeats it.
 *
 * Every touch is reported as it's released, typing a key or not (`null`), with where it was released (see
 * {@link KeypadPoint}); a mouse press, as the mouse is released. Each repeat of backspace held down is reported where the
 * finger is, and releasing it after it repeated, nothing. A touch the browser cancels isn't reported. Keys typed on a
 * physical keyboard, or by assistive technology, are reported without a place on the keypad.
 * The keys are see-through candy buttons. Keys being pressed, by touch or keyboard, are shown pressed, a digit key for at
 * least `SPLASH_DURATION`. Each digit key shows its color on its edge; pressing it fills it with that color at once.
 * The keys don't take the focus, being typed from the keyboard's own keys, but the buttons still work with assistive
 * technology.
 *
 * What it's given goes in its grid with the keys, placing itself, such as in the empty corner left of 0.
 *
 * In developer mode, it can show the area of each key, where touches type it.
 *
 * Replaying a run, it takes no touches nor keys of its own: it shows the key of each touch replayed pressed, filled with
 * the color its digit took then, as long as it's told to, and marks where the touches were.
 */
@Component({
  selector: 'app-keypad',
  imports: [Candy],
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
    <div #grid class="grid">
      @for (position of keys(); track position.key) {
        <button
          type="button"
          appCandy="clear"
          class="key"
          [focusable]="false"
          [class.backspace]="position.key === 'backspace'"
          [pressed]="shownPressed(position.key)"
          [pressColor]="pressColor(position.key)"
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
      <ng-content />
    </div>
    @if (marks().length > 0) {
      <div class="marks" aria-hidden="true">
        @for (mark of marks(); track mark.id) {
          <span
            class="mark"
            [class.missed]="!mark.typed"
            [style.--x]="mark.x"
            [style.--y]="mark.y"
            [style.opacity]="1 - mark.faded"
          ></span>
        }
      </div>
    }
    @if (showAreas()) {
      <div class="areas" aria-hidden="true">
        @for (position of keys(); track position.key) {
          <span
            class="area"
            [attr.data-key]="position.key"
            [style.grid-row]="position.row + 1"
            [style.grid-column]="position.column + 1"
            [style.--key-color]="pressColor(position.key)"
          ></span>
        }
      </div>
    }
  `,
  styleUrl: './keypad.css',
})
export class Keypad {
  /** Each digit key's color: the color its digit takes when typed next. */
  readonly colors = input.required<Readonly<Record<Digit, string>>>();
  /** Where the keys sit. */
  readonly layout = input<KeypadLayout>(DEFAULT_KEYPAD_LAYOUT);
  /** Whether to show the area of each key, where touches type it. */
  readonly showAreas = input(false);
  /** Whether it takes no touches nor keys, as while a run is replayed. */
  readonly disabled = input(false);
  /** A key to show pressed, whatever presses it, as the key of a touch replayed. */
  readonly shown = input<KeypadKey>();
  /** Touches to mark where they were, as those replayed. */
  readonly marks = input<readonly KeypadMark[]>([]);
  /** A touch on the keypad, or a key typed: what it typed, if anything, and where it was. */
  readonly touched = output<KeypadTouch>();

  protected readonly keys = computed(() => KEY_POSITIONS[this.layout()]);

  /** Keys held down on a physical keyboard. */
  protected readonly heldKeys = signal<readonly KeypadKey[]>([]);
  /** Keys being touched. */
  protected readonly touchedKeys = signal<readonly KeypadKey[]>([]);
  /** Touches in progress, by pointer. */
  private readonly presses = new Map<number, Press>();
  /** The color each digit key was filled with when last pressed: the color its digit takes. */
  private readonly splashColors = signal<Partial<Record<Digit, string>>>({});
  /** Digit keys pressed less than `SPLASH_DURATION` ago, which stay filled even once released. */
  private readonly splashing = signal<readonly Digit[]>([]);
  private readonly splashTimers = new Map<Digit, ReturnType<typeof setTimeout>>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly grid = viewChild.required<ElementRef<HTMLElement>>('grid');

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const press of this.presses.values()) {
        clearTimeout(press.timer);
      }
      for (const timer of this.splashTimers.values()) {
        clearTimeout(timer);
      }
    });
  }

  private isPressed(key: KeypadKey): boolean {
    return (
      this.heldKeys().includes(key) || this.touchedKeys().includes(key) || this.shown() === key
    );
  }

  /**
   * Notes the color a key's digit takes when typed now, which it's filled with while shown pressed, as for a touch
   * replayed.
   */
  noteColor(key: KeypadKey | null): void {
    if (key !== null && key !== 'backspace') {
      const color = this.colors()[key];
      this.splashColors.update((colors) => ({ ...colors, [key]: color }));
    }
  }

  /** Whether a key shows pressed: while pressed, and, for a digit key, for a moment after. */
  protected shownPressed(key: KeypadKey): boolean {
    return this.isPressed(key) || (key !== 'backspace' && this.splashing().includes(key));
  }

  /**
   * A digit key's color: while it shows pressed, the color its digit took then, and otherwise the color it takes when
   * typed next. Backspace has none.
   */
  protected pressColor(key: KeypadKey): string | undefined {
    if (key === 'backspace') {
      return undefined;
    }
    return (this.shownPressed(key) ? this.splashColors()[key] : undefined) ?? this.colors()[key];
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || this.disabled()) {
      return;
    }
    const { key, point } = this.touchAt(event);
    // No focus change, text selection or emulated mouse events: the touch is all ours.
    event.preventDefault();
    this.host.setPointerCapture(event.pointerId);
    this.dropPress(event.pointerId);
    const press: Press = {
      key,
      slid: false,
      repeated: false,
      point,
      timer:
        key === 'backspace'
          ? setTimeout(() => {
              this.repeat(event.pointerId);
            }, REPEAT_DELAY)
          : undefined,
    };
    this.presses.set(event.pointerId, press);
    this.updateTouchedKeys();
    if (key !== null) {
      this.splash(key);
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    const press = this.presses.get(event.pointerId);
    if (press === undefined) {
      return;
    }
    const { key, point } = this.touchAt(event);
    press.point = point;
    if (!press.slid && key !== press.key) {
      this.slideOff(press);
    }
  }

  protected onPointerUp(event: PointerEvent): void {
    const press = this.presses.get(event.pointerId);
    if (press === undefined) {
      return;
    }
    this.dropPress(event.pointerId);
    if (press.repeated) {
      return;
    }
    const { key, point } = this.touchAt(event);
    this.touched.emit({ key: !press.slid && key === press.key ? key : null, ...point });
  }

  /** Ends a touch the browser cancels, without typing its key, and without leaving its key filled. */
  protected cancelPress(pointerId: number): void {
    const press = this.presses.get(pointerId);
    if (press !== undefined) {
      this.dropPress(pointerId);
      this.slideOff(press);
    }
  }

  /** Lets go of the key a touch slid off: it no longer types it, nor shows it pressed or filled. */
  private slideOff(press: Press): void {
    press.slid = true;
    clearTimeout(press.timer);
    this.updateTouchedKeys();
    if (press.key !== null) {
      this.endSplash(press.key);
    }
  }

  /** Forgets a touch. */
  private dropPress(pointerId: number): void {
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
    if (event.detail === 0 && !this.disabled()) {
      this.type(key);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const key = keyFor(event);
    if (key === null || this.disabled()) {
      return;
    }
    event.preventDefault();
    this.heldKeys.update((keys) => (keys.includes(key) ? keys : [...keys, key]));
    if (!event.repeat) {
      this.splash(key);
    }
    if (!event.repeat || key === 'backspace') {
      this.type(key);
    }
  }

  protected onKeyup(event: KeyboardEvent): void {
    const key = keyFor(event);
    if (key !== null) {
      this.heldKeys.update((keys) => keys.filter((held) => held !== key));
    }
  }

  /** Types a key without touching the keypad. */
  private type(key: KeypadKey): void {
    this.touched.emit({ key });
  }

  private repeat(pointerId: number): void {
    const press = this.presses.get(pointerId);
    if (press?.key == null) {
      return;
    }
    press.repeated = true;
    press.timer = setTimeout(() => {
      this.repeat(pointerId);
    }, REPEAT_INTERVAL);
    this.touched.emit({ key: press.key, ...press.point });
  }

  /** Fills a digit key with its color: the color its digit takes when typed now. */
  private splash(key: KeypadKey): void {
    if (key === 'backspace') {
      return;
    }
    this.noteColor(key);
    this.splashing.update((keys) => (keys.includes(key) ? keys : [...keys, key]));
    clearTimeout(this.splashTimers.get(key));
    this.splashTimers.set(
      key,
      setTimeout(() => {
        this.endSplash(key);
      }, SPLASH_DURATION),
    );
  }

  private endSplash(key: KeypadKey): void {
    if (key === 'backspace') {
      return;
    }
    clearTimeout(this.splashTimers.get(key));
    this.splashTimers.delete(key);
    this.splashing.update((keys) => keys.filter((splashing) => splashing !== key));
  }

  private updateTouchedKeys(): void {
    this.touchedKeys.set(
      Array.from(this.presses.values()).flatMap((press) =>
        press.key === null || press.slid ? [] : [press.key],
      ),
    );
  }

  /** Where a point on the screen is on the keypad, such as that of a touch elsewhere on the screen. */
  pointOf(event: PointerEvent): KeypadPoint {
    return this.touchAt(event).point;
  }

  /** Where a touch is on the keypad, and the key there: none outside the keypad, where touches reach no key. */
  private touchAt(event: PointerEvent): {
    readonly key: KeypadKey | null;
    readonly point: KeypadPoint;
  } {
    const grid = this.grid().nativeElement;
    const style = getComputedStyle(grid);
    const point = pointAt(
      grid.getBoundingClientRect(),
      // None where there's no layout, as in tests.
      { column: parseFloat(style.columnGap) || 0, row: parseFloat(style.rowGap) || 0 },
      event.clientX,
      event.clientY,
    );
    const area = this.host.getBoundingClientRect();
    const inside =
      event.clientX >= area.left &&
      event.clientX < area.right &&
      event.clientY >= area.top &&
      event.clientY < area.bottom;
    return { key: inside ? keyAt(this.layout(), point) : null, point };
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
