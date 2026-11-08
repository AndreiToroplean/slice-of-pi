import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Digit, DIGITS, isDigit } from '../../../game/pi/digit';
import { PALETTE, Palette } from '../../../game/layers/place-colors';
import {
  DEFAULT_KEYPAD_LAYOUT,
  KEY_POSITIONS,
  KeypadKey,
  KeypadLayout,
  KeypadPoint,
  KeypadTouch,
  isNearKey,
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
/** How far a touch can slide off its key and still type it, in steps from one key to the next (a key and a gap). */
export const SLIDE_GRACE = 1;

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
  /** Whether it's too far off its key to type it if released now; its key then doesn't show pressed. */
  far: boolean;
  /** Whether the key has already repeated, in which case releasing it does not type it once more. */
  repeated: boolean;
  /** Where it started, which is where it's reported. */
  readonly start: KeypadPoint;
  /** Where it is. */
  point: KeypadPoint;
  /** Pending repeat, for backspace only. */
  timer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * What the key in backspace's place is: backspace, as in free play; the discover key, which asks the game to show the
 * round, as in Discover; or nothing, as in a challenge.
 */
export type CornerKey = 'backspace' | 'discover' | 'blank';

/**
 * On-screen keypad: digits and backspace, in the layout given.
 *
 * Touches are handled on the whole keypad rather than on each button, for speed and reliability while typing fast:
 * - The keys' grid is split into cells, halfway between the keys, so a touch anywhere in a key's cell (gaps and corners
 *   included) is on it.
 * - The keys on the grid's edges reach out over the rest of the keypad, around the grid, as far as it goes, so that
 *   they're easy to hit; whoever lays it out gives it its room with its padding, which can reach over what's around.
 * - A key is typed when the touch is released no farther than `SLIDE_GRACE` beyond the key's cell, whatever is under it
 *   then: another key, or nothing, off the keypad. Released farther, it types nothing. Only where it's released counts.
 * - Several fingers can press keys at once; each key is typed when its finger is released.
 * - Holding backspace repeats it, while near enough to type it; digits don't repeat.
 * - The key in backspace's place is what the game mode makes it (see {@link CornerKey}): backspace; the discover key,
 *   which asks the game to show the round, gold-rimmed, and held down in gold while the game shows it; or nothing,
 *   blank and inert, touches on it typing nothing. Its shape stays, so that the keypad looks the same in every mode.
 *   On a keyboard, Backspace types backspace and the space bar the discover key.
 *
 * Keys can also be typed on a physical keyboard: they are typed when pressed, and backspace repeats as the keyboard
 * repeats it.
 *
 * Every touch is reported as it's released, typing a key or not (`null`), with where it started, the spot the player
 * aimed at (see {@link KeypadPoint}); a mouse press, as the mouse is released. Each repeat of backspace held down is
 * reported likewise, and releasing it after it repeated, nothing. A touch the browser cancels isn't reported. Keys typed on a
 * physical keyboard, or by assistive technology, are reported without a place on the keypad.
 * The keys are candy buttons, see-through unless solid, backspace see-through all the same. Keys being pressed, by touch or keyboard, are shown pressed (a touch's key only
 * while releasing it would type it), a digit key for at least `SPLASH_DURATION`. Each digit key shows its color: see-through, on
 * its edge, and pressing it fills it with that color at once; solid, all over.
 * The keys don't take the focus, being typed from the keyboard's own keys, but the buttons still work with assistive
 * technology.
 *
 * What it's given goes in its grid with the keys, placing itself, such as the pause key in the empty corner left of 0.
 * The buttons it's given, and the dialogs they open, take their own touches, which aren't the keypad's.
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
          [appCandy]="solid() && position.key !== 'backspace' ? 'white' : 'clear'"
          class="key"
          [focusable]="false"
          [class.backspace]="position.key === 'backspace'"
          [class.discover]="position.key === 'backspace' && corner() === 'discover'"
          [pressed]="shownPressed(position.key)"
          [pressColor]="pressColor(position.key)"
          [attr.data-key]="position.key"
          [attr.aria-label]="position.key === 'backspace' ? cornerLabel() : null"
          [inert]="position.key === 'backspace' && corner() === 'blank'"
          [style.grid-row]="position.row + 1"
          [style.grid-column]="position.column + 1"
          (click)="onClick($event, position.key)"
        >
          @if (position.key === 'backspace') {
            @switch (corner()) {
              @case ('backspace') {
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.5 5h11a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-11L3 12z" />
                  <path d="m11 9 6 6m0-6-6 6" />
                </svg>
              }
              @case ('discover') {
                <!-- An eye: show me. -->
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              }
            }
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
  /** Each digit key's color index: where the color its digit takes when typed next is in the palette. */
  readonly colorIndices = input.required<Readonly<Record<Digit, number>>>();
  /** The palette the keys take their colors from. */
  readonly palette = input<Palette>(PALETTE);
  /** Where the keys sit. */
  readonly layout = input<KeypadLayout>(DEFAULT_KEYPAD_LAYOUT);
  /** Whether the digit keys are solid, each in its color, rather than see-through. */
  readonly solid = input(false);
  /** Whether to show the area of each key, where touches type it. */
  readonly showAreas = input(false);
  /** What the key in backspace's place is, as the game mode makes it. */
  readonly corner = input<CornerKey>('backspace');
  /** Whether the discover key shows held down, as while the game shows the round. */
  readonly held = input(false);
  /** The discover key was pressed: the player asks the game to show the round. */
  readonly discover = output();
  /**
   * How long a digit key's color lingers on its face once it stops showing pressed, in milliseconds, fading out to the
   * color its digit takes next: none at 0.
   */
  readonly linger = input(0);
  /** Whether it takes no touches nor keys, as while a run is replayed. */
  readonly disabled = input(false);
  /** A key to show pressed, whatever presses it, as the key of a touch replayed. */
  readonly shown = input<KeypadKey>();
  /** Touches to mark where they were, as those replayed. */
  readonly marks = input<readonly KeypadMark[]>([]);
  /** A touch on the keypad, or a key typed: what it typed, if anything, and where it was. */
  readonly touched = output<KeypadTouch>();
  /**
   * A key touched, as the touch lands on it, before it's typed, if it is: the player can listen to it before they commit
   * to it. Keys typed on a keyboard, or by assistive technology, are typed at once, and never pressed first.
   */
  readonly pressed = output<KeypadKey>();

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

  /** The digit keys showing pressed, the last time it looked. */
  private wasPressed: readonly Digit[] = [];
  /** The lingering color of each digit key, fading out. */
  private readonly lingering = new Map<Digit, Animation>();

  constructor() {
    // A digit key that stops showing pressed keeps the color it took for a moment, fading out.
    effect(() => {
      const pressed = DIGITS.filter((digit) => this.shownPressed(digit));
      const released = this.wasPressed.filter((digit) => !pressed.includes(digit));
      this.wasPressed = pressed;
      untracked(() => {
        for (const digit of pressed) {
          this.lingering.get(digit)?.cancel();
        }
        for (const digit of released) {
          this.lingerOn(digit);
        }
      });
    });
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
      const color = this.colorOf(key);
      this.splashColors.update((colors) => ({ ...colors, [key]: color }));
    }
  }

  /** Whether a key shows pressed: while pressed, and, for a digit key, for a moment after. */
  protected shownPressed(key: KeypadKey): boolean {
    if (key === 'backspace' && this.corner() === 'discover') {
      return this.held();
    }
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
    return (this.shownPressed(key) ? this.splashColors()[key] : undefined) ?? this.colorOf(key);
  }

  /** The color a digit key's digit takes when typed next. */
  private colorOf(key: Digit): string | undefined {
    return this.palette()[this.colorIndices()[key]];
  }

  /** Whether a touch is on a button the keypad was given, or a dialog it opened, rather than on the keypad. */
  private givenTouch(event: PointerEvent): boolean {
    return (
      event.target instanceof Element && event.target.closest('dialog, button:not(.key)') !== null
    );
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || this.disabled() || this.givenTouch(event)) {
      return;
    }
    const { key, point } = this.touchAt(event);
    // No focus change, text selection or emulated mouse events: the touch is all ours.
    event.preventDefault();
    this.host.setPointerCapture(event.pointerId);
    this.dropPress(event.pointerId);
    const press: Press = {
      key,
      far: false,
      repeated: false,
      start: point,
      point,
      timer:
        key === 'backspace' && this.corner() === 'backspace'
          ? setTimeout(() => {
              this.repeat(event.pointerId);
            }, REPEAT_DELAY)
          : undefined,
    };
    this.presses.set(event.pointerId, press);
    this.updateTouchedKeys();
    if (key !== null) {
      this.splash(key);
      this.pressed.emit(key);
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    const press = this.presses.get(event.pointerId);
    if (press === undefined) {
      return;
    }
    press.point = this.touchAt(event).point;
    this.checkDistance(press);
  }

  protected onPointerUp(event: PointerEvent): void {
    const press = this.presses.get(event.pointerId);
    if (press === undefined) {
      return;
    }
    press.point = this.touchAt(event).point;
    this.checkDistance(press);
    this.dropPress(event.pointerId);
    if (!press.repeated) {
      this.report({ key: press.far ? null : press.key, ...press.start });
    }
  }

  /** Notes whether a touch is too far off its key to type it, showing its key pressed only while it isn't. */
  private checkDistance(press: Press): void {
    if (press.key === null) {
      return;
    }
    const far = !isNearKey(this.layout(), press.key, press.point, SLIDE_GRACE);
    if (far !== press.far) {
      press.far = far;
      this.updateTouchedKeys();
      if (far) {
        this.endSplash(press.key);
      }
    }
  }

  /** Ends a touch the browser cancels, without typing its key, and without leaving its key filled. */
  protected cancelPress(pointerId: number): void {
    const press = this.presses.get(pointerId);
    if (press !== undefined) {
      this.dropPress(pointerId);
      if (press.key !== null) {
        this.endSplash(press.key);
      }
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
    if (event.detail === 0 && !this.disabled() && this.works(key)) {
      this.type(key);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const key = keyFor(event, this.corner());
    if (key === null || this.disabled() || !this.works(key)) {
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
    const key = keyFor(event, this.corner());
    if (key !== null) {
      this.heldKeys.update((keys) => keys.filter((held) => held !== key));
    }
  }

  /** Types a key without touching the keypad. */
  private type(key: KeypadKey): void {
    this.report({ key });
  }

  /** Reports a touch, or a key typed, but the discover key's, which asks the game to show the round instead. */
  private report(touch: KeypadTouch): void {
    if (touch.key === 'backspace' && this.corner() === 'discover') {
      this.discover.emit();
    } else {
      this.touched.emit(touch);
    }
  }

  /** What the key in backspace's place is called. */
  protected readonly cornerLabel = computed(() =>
    this.corner() === 'discover' ? 'Show me' : 'Delete last digit',
  );

  private repeat(pointerId: number): void {
    const press = this.presses.get(pointerId);
    if (press?.key == null) {
      return;
    }
    press.timer = setTimeout(() => {
      this.repeat(pointerId);
    }, REPEAT_INTERVAL);
    if (!press.far) {
      press.repeated = true;
      this.touched.emit({ key: press.key, ...press.start });
    }
  }

  /** Lets the color a digit key took as it was pressed linger on its face, fading out. */
  private lingerOn(digit: Digit): void {
    const duration = this.linger();
    const key = this.host.querySelector<HTMLElement>(`.key[data-key="${digit}"]`);
    const color = this.splashColors()[digit];
    if (duration <= 0 || key === null || color === undefined || typeof key.animate !== 'function') {
      return;
    }
    key.style.setProperty('--linger-color', color);
    this.lingering.set(
      digit,
      key.animate([{ '--linger': 1 }, { '--linger': 0 }], { duration, easing: 'ease-out' }),
    );
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
        press.key === null || press.far ? [] : [press.key],
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
    const key = inside ? keyAt(this.layout(), point) : null;
    return { key: key !== null && this.works(key) ? key : null, point };
  }

  /** Whether a key works: every one does, but the key in backspace's place where it's blank. */
  private works(key: KeypadKey): boolean {
    return key !== 'backspace' || this.corner() !== 'blank';
  }
}

/**
 * The keypad key a physical key press stands for, if any: the key in backspace's place is typed with Backspace, but
 * with the space bar where it's the discover key.
 */
function keyFor(event: KeyboardEvent, corner: CornerKey): KeypadKey | null {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  if (event.key === (corner === 'discover' ? ' ' : 'Backspace')) {
    return 'backspace';
  }
  return isDigit(event.key) ? event.key : null;
}
