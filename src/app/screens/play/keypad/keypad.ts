import {
  afterNextRender,
  ChangeDetectorRef,
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
import { KEY_MOTION, KeyMotion, Joint, jointsOf, Merges, moving, stepMerges } from './key-merges';
import { OTHER_KEY_COLORS, OtherKeyColors } from './other-keys';
import { keyShapes } from './key-shapes';
import { GlKey, GlScene, KeypadRenderer, premultiplied, rgba } from './keypad-gl';

/** How far a frosted key blurs what's behind it, in CSS pixels: as the candy buttons' frost does (`--frost-blur`). */
const FROST_BLUR = 10;

/** An element's size, as laid out, in CSS pixels. */
interface KeySize {
  readonly width: number;
  readonly height: number;
}

/** The sizes the keys are drawn from, measured on the grid, in CSS pixels. */
interface KeyGeometry {
  readonly width: number;
  readonly height: number;
  readonly gapX: number;
  readonly gapY: number;
  readonly radius: number;
  readonly depth: number;
}

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
 * What the key in backspace's place is: backspace, as in free play, and in a challenge, where it's disabled; or the
 * discover key, which switches turns, as in Discover.
 */
export type CornerKey = 'backspace' | 'discover';

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
 *   which switches turns, gold-rimmed, and gold all over while the game shows the round. Disabled, as backspace is in
 *   a challenge, it shows disabled, and touches on it type nothing. The digit keys can be locked, as on the game's
 *   turn: they look as ever, but type nothing.
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
      <!-- The digit keys, drawn in one canvas, under their buttons, which then only say their digits. -->
      <canvas
        #canvas
        class="gl"
        aria-hidden="true"
        [hidden]="!drawing()"
        [style.left.px]="-glMargin()"
        [style.top.px]="-glMargin()"
        [style.width]="'calc(100% + ' + 2 * glMargin() + 'px)'"
        [style.height]="'calc(100% + ' + 2 * glMargin() + 'px)'"
      ></canvas>
      @for (position of keys(); track position.key) {
        <button
          type="button"
          [appCandy]="solid() && position.key !== 'backspace' ? 'white' : 'clear'"
          class="key"
          [focusable]="false"
          [class.backspace]="position.key === 'backspace'"
          [class.discover]="position.key === 'backspace' && corner() === 'discover'"
          [class.lit]="position.key === 'backspace' && corner() === 'discover' && lit()"
          [attr.aria-disabled]="position.key === 'backspace' && cornerDisabled() ? true : null"
          [pressed]="shownPressed(position.key)"
          [pressColor]="pressColor(position.key)"
          [attr.data-key]="position.key"
          [attr.aria-label]="position.key === 'backspace' ? cornerLabel() : null"
          [style.grid-row]="position.row + 1"
          [style.grid-column]="position.column + 1"
          [class.drawn]="isDrawn(position.key)"
          [class.driven]="isDriven(position.key)"
          [style.--rim]="rimOf(position.key)"
          [style.translate]="sinkOf(position.key)"
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
    <!-- The lengths the keys are drawn with, as the layout sets them, measured as they change. -->
    <span class="metric radius" #radiusProbe aria-hidden="true"></span>
    <span class="metric depth" #depthProbe aria-hidden="true"></span>
    <span class="metric gaps" #gapsProbe aria-hidden="true"></span>
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
  /** The colors of the keys besides the digit keys, of which the key in backspace's place takes its own. */
  readonly otherKeys = input<OtherKeyColors>(OTHER_KEY_COLORS);
  /** Where the keys sit. */
  readonly layout = input<KeypadLayout>(DEFAULT_KEYPAD_LAYOUT);
  /** Whether the digit keys are solid, each in its color, rather than see-through. */
  readonly solid = input(false);
  /** Whether keys next to each other of the same color merge into one piece. */
  readonly mergeKeys = input(true);
  /**
   * Whether the keys are plain candy buttons, never merging, as while the layout is edited: they draw themselves,
   * rather than the canvas, at once, those merged split. The canvas would have to follow the layout's every change,
   * its size and its reach included, a frame behind.
   */
  readonly plain = input(false);
  /** How long they take to merge, and to sink, pressed. */
  readonly motion = input<KeyMotion>(KEY_MOTION);
  /** Whether to show the area of each key, where touches type it. */
  readonly showAreas = input(false);
  /** What the key in backspace's place is, as the game mode makes it. */
  readonly corner = input<CornerKey>('backspace');
  /** Whether the discover key is gold all over, as while the game shows the round. */
  readonly lit = input(false);
  /** Whether the digit keys type nothing, as while the game shows the round, looking as ever all the same. */
  readonly digitsLocked = input(false);
  /**
   * Whether the key in backspace's place doesn't work, as backspace in a challenge, or the discover key until the
   * player has retyped the round: it shows disabled, and touches on it type nothing.
   */
  readonly cornerDisabled = input(false);
  /** The discover key was pressed: the player switches turns. */
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
  private readonly radiusProbe = viewChild.required<ElementRef<HTMLElement>>('radiusProbe');
  private readonly depthProbe = viewChild.required<ElementRef<HTMLElement>>('depthProbe');
  private readonly gapsProbe = viewChild.required<ElementRef<HTMLElement>>('gapsProbe');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  /** What draws the digit keys, once the canvas is there, if WebGL works. */
  protected readonly renderer = signal<KeypadRenderer | undefined>(undefined);
  /** Whether the canvas draws the digit keys: once it can, unless they're plain. */
  protected readonly drawing = computed(() => this.renderer() !== undefined && !this.plain());
  private pendingScene: GlScene | undefined;
  /** Whether the player asked for no motion, as the end-to-end tests do. */
  private readonly still =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** How far the canvas reaches past the grid, for the keys' edges. */
  protected readonly glMargin = computed(() => Math.ceil((this.geometry()?.depth ?? 0) + 24));

  /** The digit keys, as the canvas draws them. */
  private readonly scene = computed((): GlScene | undefined => {
    const geometry = this.geometry();
    if (geometry === undefined) {
      return undefined;
    }
    const solid = this.solid();
    const keys = this.keys().flatMap(({ key, row, column }) =>
      key === 'backspace'
        ? []
        : [
            {
              key,
              row,
              column,
              box: {
                x: column * (geometry.width + geometry.gapX),
                y: row * (geometry.height + geometry.gapY),
                width: geometry.width,
                height: geometry.height,
              },
            },
          ],
    );
    const shapes = keyShapes(
      keys,
      this.joints(),
      this.merges(),
      geometry.radius,
      geometry.gapX,
      geometry.gapY,
    );
    return {
      width: 3 * geometry.width + 2 * geometry.gapX,
      height: 4 * geometry.height + 3 * geometry.gapY,
      margin: this.glMargin(),
      depth: geometry.depth,
      gapX: geometry.gapX,
      gapY: geometry.gapY,
      highlight: solid ? 0 : 0.45,
      blur: FROST_BLUR,
      frosted: !solid,
      keys: shapes.map((shape): GlKey => {
        const pressed = this.shownPressed(shape.key);
        const color = this.pressColor(shape.key);
        const base = color === undefined ? undefined : rgba(color);
        const [r, g, b, a] = base ?? [1, 1, 1, 1];
        const linger = this.lingers().get(shape.key);
        // Fading out as an `ease-out` animation does.
        const left = linger === undefined ? 0 : 1 - (this.clock() - linger.since) / this.linger();
        const lingering = Math.min(1, Math.max(0, left)) ** 2;
        const [lr, lg, lb] = linger === undefined ? [0, 0, 0] : rgba(linger.color);
        return {
          ...shape,
          linger: [lr, lg, lb],
          lingering: pressed ? 0 : lingering,
          sink: this.sunk(shape.key),
          face: solid || pressed ? premultiplied(base ?? [1, 1, 1, 1]) : [0.26, 0.26, 0.26, 0.26],
          rim: solid
            ? premultiplied([r * 0.72, g * 0.72, b * 0.72, a])
            : base === undefined
              ? premultiplied([40 / 255, 20 / 255, 60 / 255, 1], 0.22)
              : premultiplied(base),
        };
      }),
    };
  });
  private readonly changeDetector = inject(ChangeDetectorRef);

  /** The digit keys showing pressed, the last time it looked. */
  private wasPressed: readonly Digit[] = [];
  /**
   * The color lingering on each digit key, and when it started fading out: drawn by the keypad, or, as the keys'
   * buttons draw themselves, by an animation of theirs.
   */
  private readonly lingers = signal<
    ReadonlyMap<Digit, { readonly color: string; readonly since: number }>
  >(new Map());
  private readonly lingering = new Map<Digit, Animation>();
  /** When the keypad last drew a frame, to time what fades. */
  private readonly clock = signal(0);

  /** The joints between the digit keys, where they merge. */
  private readonly joints = computed(() => jointsOf(this.layout()));
  /** How far each digit key has sunk, pressed, from 0, up, to 1, all the way. */
  private readonly sinks = signal<ReadonlyMap<Digit, number>>(new Map());
  /** Digit keys pressed that haven't sunk all the way yet: they do, however soon they're let go, before rising back. */
  private readonly sinking = new Set<Digit>();
  /** How far each joint has merged. */
  private readonly merges = signal<Merges>(new Map());
  /** The sizes the keys are drawn with, once laid out. */
  private readonly geometry = signal<KeyGeometry | undefined>(undefined);
  /** Whether the keys were plain, the last time it looked: turning plain, or back, settles the merges at once. */
  private wasPlain = false;
  private frame: number | undefined;
  private lastFrame = 0;
  /** Whether a key is drawn by the keypad's canvas, its button only saying its digit. */
  protected isDrawn(key: KeypadKey): boolean {
    return key !== 'backspace' && this.drawing();
  }

  /**
   * Whether a digit key's button is moved by the keypad, rather than moving itself: its sink, and its edge (rim), as
   * thick as its depth less how far it has sunk, whoever draws it, so that it looks the same either way, and as it
   * swaps from one to the other.
   */
  protected isDriven(key: KeypadKey): boolean {
    return key !== 'backspace' && this.geometry() !== undefined;
  }

  /** How thick a digit key's button's edge is, as it sinks: its depth, unless it has sunk. */
  protected rimOf(key: KeypadKey): string | null {
    if (!this.isDriven(key) || key === 'backspace') {
      return null;
    }
    const sunk = this.sunk(key);
    return sunk === 0 ? null : `${String(Math.max(0, (this.geometry()?.depth ?? 0) - sunk))}px`;
  }

  /** How far a digit key has sunk, pressed, in CSS pixels: as a candy button does, into its edge but a pixel. */
  private sunk(digit: Digit): number {
    const depth = this.geometry()?.depth ?? 0;
    return (this.sinks().get(digit) ?? 0) * Math.max(0, depth - 1);
  }

  /**
   * Where a digit key's button sits, sunk, the keypad moving it rather than the button itself, so that it's as deep
   * whoever draws it: where it is, unless it has sunk or shows pressed.
   */
  protected sinkOf(key: KeypadKey): string | null {
    if (key === 'backspace' || this.geometry() === undefined) {
      return null;
    }
    const sunk = this.sunk(key);
    // Pressed, from its first frame, before it has sunk any, so that its button never moves it itself.
    return sunk === 0 && !this.shownPressed(key) ? null : `0 ${String(sunk)}px`;
  }

  /**
   * Whether a joint's keys merge: while merging is on and both are the same color, pressed or not, as a key pressed
   * keeps its color until it's let go.
   */
  private merging(joint: Joint): boolean {
    const color = this.pressColor(joint.first);
    return (
      this.mergeKeys() &&
      !this.plain() &&
      !this.still &&
      color !== undefined &&
      color === this.pressColor(joint.second)
    );
  }

  /** Where each digit key's sink is headed: all the way while it shows pressed, back up otherwise. */
  private sinkTargets(): Map<Digit, number> {
    return new Map(
      DIGITS.map((digit) => [digit, this.shownPressed(digit) || this.sinking.has(digit) ? 1 : 0]),
    );
  }

  /** Whether any merge, or any key's sink, is still under way. */
  private animating(): boolean {
    const sinks = this.sinks();
    return (
      [...this.lingers().values()].some(({ since }) => this.clock() - since < this.linger()) ||
      moving(this.merges(), this.joints(), (joint) => this.merging(joint)) ||
      [...this.sinkTargets()].some(([digit, target]) => (sinks.get(digit) ?? target) !== target)
    );
  }

  /** Moves the merges and the keys' sinks on, a frame at a time, until they're all where they're headed. */
  private animate(): void {
    if (this.frame !== undefined || typeof requestAnimationFrame !== 'function') {
      return;
    }
    this.lastFrame = performance.now();
    const tick = (now: number): void => {
      this.clock.set(now);
      const elapsed = Math.max(0, now - this.lastFrame);
      this.lastFrame = now;
      this.merges.set(
        stepMerges(
          this.merges(),
          this.joints(),
          (joint) => this.merging(joint),
          elapsed,
          this.motion().merge,
        ),
      );
      const sinks = this.sinks();
      const press = this.motion().press;
      const step = press > 0 ? elapsed / press : Infinity;
      this.sinks.set(
        new Map(
          [...this.sinkTargets()].map(([digit, target]) => {
            const sink = sinks.get(digit) ?? target;
            return [
              digit,
              target > sink ? Math.min(target, sink + step) : Math.max(target, sink - step),
            ];
          }),
        ),
      );
      for (const digit of this.sinking) {
        if ((this.sinks().get(digit) ?? 0) >= 1) {
          this.sinking.delete(digit);
        }
      }
      this.frame = this.animating() ? requestAnimationFrame(tick) : undefined;
      // Drawn in this very frame, rather than whenever the next check comes.
      this.changeDetector.detectChanges();
    };
    this.frame = requestAnimationFrame(tick);
  }

  /**
   * Measures what the keys are drawn from as it changes, as laid out, whatever transforms the screen around: the grid's
   * size, and the lengths the layout sets, each on an element of its own sized by it: the keys' corners, their edges'
   * depth, the gaps between them. Drawn at once, before the screen shows what changed.
   */
  private watchGeometry(destroyRef: DestroyRef): void {
    if (typeof ResizeObserver !== 'function') {
      // Not laid out, as in tests: the keys' buttons draw themselves.
      return;
    }
    const elements = [this.grid(), this.gapsProbe(), this.radiusProbe(), this.depthProbe()].map(
      (element) => element.nativeElement,
    );
    // At first as laid out now, before the screen first shows the keypad, so that it never shows the keys' buttons
    // drawing themselves first; then as they change.
    const sizes = new Map<Element, KeySize>(
      elements.map((element) => {
        const style = getComputedStyle(element);
        return [
          element,
          { width: parseFloat(style.width) || 0, height: parseFloat(style.height) || 0 },
        ];
      }),
    );
    const size = (element: ElementRef<HTMLElement>): KeySize =>
      sizes.get(element.nativeElement) ?? { width: 0, height: 0 };
    const draw = (): void => {
      const grid = size(this.grid());
      const gaps = size(this.gapsProbe());
      const width = (grid.width - 2 * gaps.width) / 3;
      const height = (grid.height - 3 * gaps.height) / 4;
      if (!(width > 0 && height > 0)) {
        // Laid out at no size, as while hidden: the keys keep how they were drawn.
        return;
      }
      this.geometry.set({
        width,
        height,
        gapX: gaps.width,
        gapY: gaps.height,
        // As the browser draws them: no rounder than half the key.
        radius: Math.min(size(this.radiusProbe()).width, width / 2, height / 2),
        depth: size(this.depthProbe()).height,
      });
      this.changeDetector.detectChanges();
    };
    draw();
    const observer = new ResizeObserver((entries) => {
      for (const { target, contentRect } of entries) {
        sizes.set(target, { width: contentRect.width, height: contentRect.height });
      }
      draw();
    });
    for (const element of elements) {
      observer.observe(element);
    }
    destroyRef.onDestroy(() => {
      observer.disconnect();
    });
  }

  constructor() {
    // Keys next to each other merge while they're the same color.
    effect(() => {
      for (const digit of DIGITS) {
        this.shownPressed(digit);
        this.pressColor(digit);
      }
      const joints = this.joints();
      this.mergeKeys();
      const plain = this.plain();
      untracked(() => {
        const merging = (joint: Joint): boolean => this.merging(joint);
        this.merges.set(stepMerges(this.merges(), joints, merging, 0));
        // Plain or back, at once: the keys swap from one way of drawing to the other, unseen, with nothing to move.
        if (plain !== this.wasPlain) {
          this.wasPlain = plain;
          this.merges.set(new Map(joints.map((joint) => [joint.id, merging(joint) ? 1 : 0])));
        }
        // A key first seen is where it's headed, as are the merges.
        const sinks = this.sinks();
        this.sinks.set(
          new Map(
            [...this.sinkTargets()].map(([digit, target]) => [digit, sinks.get(digit) ?? target]),
          ),
        );
        if (this.animating()) {
          this.animate();
        }
      });
    });
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.watchGeometry(destroyRef);
      // Without motion, as the end-to-end tests ask, the keys stay plain candy buttons, never merging: it's all looks.
      if (!this.still) {
        const renderer = KeypadRenderer.create(this.canvas().nativeElement);
        if (typeof renderer !== 'string') {
          this.renderer.set(renderer);
        }
      }
    });
    effect(() => {
      const scene = this.scene();
      const renderer = this.renderer();
      if (scene === undefined || renderer === undefined || !this.drawing()) {
        return;
      }
      // At most once a frame, however often what's drawn changes within it.
      const first = this.pendingScene === undefined;
      this.pendingScene = scene;
      if (first) {
        requestAnimationFrame(() => {
          const pending = this.pendingScene;
          this.pendingScene = undefined;
          if (pending !== undefined) {
            renderer.draw(pending);
          }
        });
      }
    });
    // A digit key that stops showing pressed keeps the color it took for a moment, fading out.
    effect(() => {
      const pressed = DIGITS.filter((digit) => this.shownPressed(digit));
      const released = this.wasPressed.filter((digit) => !pressed.includes(digit));
      const newly = pressed.filter((digit) => !this.wasPressed.includes(digit));
      this.wasPressed = pressed;
      untracked(() => {
        for (const digit of pressed) {
          this.lingering.get(digit)?.cancel();
        }
        for (const digit of newly) {
          this.sinking.add(digit);
        }
        if (pressed.some((digit) => this.lingers().has(digit))) {
          this.lingers.update(
            (lingers) => new Map([...lingers].filter(([digit]) => !pressed.includes(digit))),
          );
        }
        for (const digit of released) {
          this.lingerOn(digit);
        }
      });
    });
    destroyRef.onDestroy(() => {
      for (const press of this.presses.values()) {
        clearTimeout(press.timer);
      }
      for (const timer of this.splashTimers.values()) {
        clearTimeout(timer);
      }
      if (this.frame !== undefined) {
        cancelAnimationFrame(this.frame);
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
    return this.isPressed(key) || (key !== 'backspace' && this.splashing().includes(key));
  }

  /**
   * A key's color: a digit key's, while it shows pressed, the color its digit took then, and otherwise the color it
   * takes when typed next; the key in backspace's place, its own, if any (see `OtherKeyColors`).
   */
  protected pressColor(key: KeypadKey): string | undefined {
    if (key === 'backspace') {
      return this.otherKeys()[this.corner()] ?? undefined;
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

  /** Reports a touch, or a key typed, but the discover key's, which switches turns instead. */
  private report(touch: KeypadTouch): void {
    if (touch.key === 'backspace' && this.corner() === 'discover') {
      this.discover.emit();
    } else {
      this.touched.emit(touch);
    }
  }

  /** What the key in backspace's place is called. */
  protected readonly cornerLabel = computed(() =>
    this.corner() === 'discover' ? 'Switch turns' : 'Delete last digit',
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
    if (duration <= 0 || color === undefined) {
      return;
    }
    if (this.drawing()) {
      const since = performance.now();
      this.clock.set(since);
      this.lingers.update((lingers) => new Map(lingers).set(digit, { color, since }));
      this.animate();
      return;
    }
    if (key === null || typeof key.animate !== 'function') {
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

  /** Whether a key works: every one does, but the key in backspace's place while it's disabled, and locked digits. */
  private works(key: KeypadKey): boolean {
    return key === 'backspace' ? !this.cornerDisabled() : !this.digitsLocked();
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
