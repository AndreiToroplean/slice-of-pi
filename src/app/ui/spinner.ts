import { Component, computed, inject, input, model } from '@angular/core';
import { Vibrator } from '../feedback/vibrator';

/** How far the finger travels up or right, or down or left, for each step, in CSS pixels. */
export const SPIN_DISTANCE = 24;
/** How far a press may wander before it's a drag rather than a tap, in CSS pixels. */
const TAP_SLOP = 6;

/**
 * The value a drag of `travel` pixels up or right (down or left, if negative) makes from `start`, in steps of `step`,
 * within `min` and `max`: back where the drag started, it's back to the value it started from.
 */
export function spun(
  start: number,
  travel: number,
  step: number,
  min: number,
  max: number,
): number {
  const steps = Math.trunc(travel / SPIN_DISTANCE);
  return Math.min(max, Math.max(min, start + steps * step));
}

/**
 * A number set by pressing it and dragging up or right, to raise it, or down or left, to lower it, a step for each
 * little way the finger travels, with a tick of vibration at each step: both ways at once, the way up and the way
 * right add up, down and left counting against them. Back where it started, it's back to the value it started from.
 * The up and down arrow keys step it too, and Home and End go to its ends, as for any spin button; left and right are
 * left to what holds it, to move between its buttons. A press that drags isn't a click on what holds it.
 * It's as wide as its widest value could be, as many of the widest digit as that has digits, so that it never changes
 * width as it's set, whatever the font's digits.
 */
@Component({
  selector: 'app-spinner',
  host: {
    role: 'spinbutton',
    tabindex: '0',
    '[attr.aria-label]': 'label()',
    '[attr.aria-valuenow]': 'value()',
    '[attr.aria-valuemin]': 'min()',
    '[attr.aria-valuemax]': 'max()',
    '(pointerdown)': 'down($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'up($event)',
    '(pointercancel)': 'up($event)',
    '(click)': 'click($event)',
    '(keydown)': 'keydown($event)',
  },
  template: `
    <span class="value">
      <span class="shown">{{ value() }}</span>
      <!-- Each digit as many times as the widest value has digits, unseen: the widest of them sets its width. -->
      @for (sizer of sizers(); track $index) {
        <span class="sizer" aria-hidden="true">{{ sizer }}</span>
      }
    </span>
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m8 9 4-4 4 4" />
      <path d="m8 15 4 4 4-4" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.125rem;
      font-variant-numeric: tabular-nums;
      /* Dragging moves the value, not the page. */
      touch-action: none;
      cursor: move;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    /* The value and the unseen digits in one place, as wide as the widest. */
    .value {
      display: inline-grid;
    }

    .value > * {
      grid-area: 1 / 1;
    }

    .sizer {
      visibility: hidden;
    }

    svg {
      width: 1em;
      height: 1em;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0.7;
    }

    :host(:focus-visible) {
      outline: 0.1875rem solid transparent;
      border-radius: 0.5rem;
      box-shadow: var(--selected-glow);
    }
  `,
})
export class Spinner {
  /** What it sets, for screen readers. */
  readonly label = input.required<string>();
  readonly value = model.required<number>();
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly step = input(1);
  /** Each digit, as many times as its widest value has digits: the widest of them is as wide as it may need. */
  protected readonly sizers = computed(() => {
    const digits = Math.max(String(this.min()).length, String(this.max()).length);
    return Array.from('0123456789', (digit) => digit.repeat(digits));
  });
  private readonly vibrator = inject(Vibrator);
  /** The press being dragged, if any: where it started, and the value then. */
  private press:
    | { readonly id: number; readonly x: number; readonly y: number; readonly value: number }
    | undefined;
  /** Whether the last press dragged, so that its click is no tap. */
  private dragged = false;

  protected down(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    this.press = { id: event.pointerId, x: event.clientX, y: event.clientY, value: this.value() };
    this.dragged = false;
  }

  protected move(event: PointerEvent): void {
    const press = this.press;
    if (press?.id !== event.pointerId) {
      return;
    }
    const rise = press.y - event.clientY;
    const right = event.clientX - press.x;
    this.dragged ||= Math.max(Math.abs(rise), Math.abs(right)) > TAP_SLOP;
    this.set(spun(press.value, rise + right, this.step(), this.min(), this.max()));
  }

  protected up(event: PointerEvent): void {
    if (this.press?.id === event.pointerId) {
      this.press = undefined;
    }
  }

  /** Keeps a drag from clicking what holds it. */
  protected click(event: MouseEvent): void {
    if (this.dragged) {
      this.dragged = false;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  protected keydown(event: KeyboardEvent): void {
    const step = this.step();
    const next = {
      ArrowUp: this.value() + step,
      ArrowDown: this.value() - step,
      Home: this.min(),
      End: this.max(),
    }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      this.set(Math.min(this.max(), Math.max(this.min(), next)));
    }
  }

  /** Sets the value, with a tick of vibration if it moved. */
  private set(value: number): void {
    if (value !== this.value()) {
      this.value.set(value);
      this.vibrator.play('spin');
    }
  }
}
