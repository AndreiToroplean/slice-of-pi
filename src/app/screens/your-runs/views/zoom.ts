import { DestroyRef, Directive, ElementRef, inject, input, model } from '@angular/core';
import type { Range } from './plot';

/** How far a chart zooms in at most: to this share of its whole x-axis. */
const DEEPEST = 1 / 40;
/** How much a step of the mouse wheel zooms, per pixel it scrolls. */
const WHEEL_RATE = 0.002;
/**
 * How many pixels a line of the mouse wheel scrolls, as browsers count them when they count in pixels: a notch scrolls 3
 * lines, 100 pixels, where the system scrolls 3 lines to a notch, as it does by default.
 */
const LINE = 100 / 3;
/** How many lines a page of the wheel scrolls, for a wheel that counts in pages. */
const PAGE = 20;
/** How long after a pinch a tap isn't taken for one, in milliseconds: the fingers lift one after the other. */
const PINCH_TAIL = 400;

/**
 * Zooms a chart in and out along its x-axis only, never its y-axis: with the mouse wheel over it, around the pointer,
 * or a pinch, around the fingers, which pan it too as they move together; the wheel with Shift, or a sideways scroll,
 * pans it, by one unit of x, such as a digit, for each line the wheel scrolls. The window shown is a model, `zoom`, so
 * that charts sharing an axis zoom together: `undefined` is the whole axis, `appZoom`. Taps that end a pinch don't
 * reach the chart, so that they don't pick what's under them. A pinch holds still whatever scrolls sideways around the
 * chart, such as a carousel, which the browser may have started scrolling with the first finger, before the second
 * came: it's back where it was once the fingers lift.
 */
@Directive({
  selector: '[appZoom]',
  host: {
    '(wheel)': 'wheel($event)',
    '(touchstart)': 'touchStart($event)',
    '(touchmove)': 'touchMove($event)',
    '(touchend)': 'touchEnd($event)',
    '(touchcancel)': 'touchEnd($event)',
  },
})
export class Zoom {
  /** The whole x-axis. */
  readonly whole = input.required<Range>({ alias: 'appZoom' });
  /** The window of it shown: all of it if undefined. */
  readonly zoom = model<Range | undefined>(undefined);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** The pinch going on: the window and the fingers as it started. */
  private pinch:
    { readonly window: Range; readonly anchor: number; readonly distance: number } | undefined;
  private pinchedAt = -Infinity;
  /** What scrolls sideways around the chart, held still during a pinch, and where it was as the first finger landed. */
  private held: { readonly scroller: HTMLElement; readonly left: number } | undefined;
  private landedAt: { readonly scroller: HTMLElement; readonly left: number } | undefined;

  constructor() {
    // Taps that end a pinch are caught before the chart sees them.
    const swallow = (event: Event): void => {
      if (performance.now() - this.pinchedAt < PINCH_TAIL) {
        event.stopPropagation();
      }
    };
    this.host.addEventListener('pointerup', swallow, true);
    inject(DestroyRef).onDestroy(() => {
      this.host.removeEventListener('pointerup', swallow, true);
    });
  }

  protected wheel(event: WheelEvent): void {
    const window = this.window();
    const at = this.fraction(event.clientX);
    if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      // With Shift, or sideways, the wheel pans, if there's anywhere to pan to.
      if (this.zoom() !== undefined) {
        event.preventDefault();
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        this.show(window.min + pixels(delta, event.deltaMode) / LINE, window.max - window.min);
      }
      return;
    }
    event.preventDefault();
    const width =
      (window.max - window.min) * Math.exp(pixels(event.deltaY, event.deltaMode) * WHEEL_RATE);
    const point = window.min + at * (window.max - window.min);
    this.show(point - at * this.clampWidth(width), width);
  }

  protected touchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      const scroller = this.scroller();
      this.landedAt = scroller === undefined ? undefined : { scroller, left: scroller.scrollLeft };
    }
    const fingers = this.fingers(event);
    if (fingers !== undefined) {
      event.preventDefault();
      this.hold();
      const window = this.window();
      this.pinch = {
        window,
        anchor: window.min + this.fraction(fingers.middle) * (window.max - window.min),
        distance: Math.max(1, fingers.distance),
      };
    }
  }

  protected touchMove(event: TouchEvent): void {
    const fingers = this.fingers(event);
    const pinch = this.pinch;
    if (fingers === undefined || pinch === undefined) {
      return;
    }
    event.preventDefault();
    const width = this.clampWidth(
      ((pinch.window.max - pinch.window.min) * pinch.distance) / Math.max(1, fingers.distance),
    );
    // What was under the fingers as they landed stays under them.
    this.show(pinch.anchor - this.fraction(fingers.middle) * width, width);
    this.pinchedAt = performance.now();
  }

  protected touchEnd(event: TouchEvent): void {
    if (event.touches.length < 2 && this.pinch !== undefined) {
      this.pinch = undefined;
      this.pinchedAt = performance.now();
      this.release();
    }
    if (event.touches.length === 0) {
      this.landedAt = undefined;
    }
  }

  /** Holds still what scrolls sideways around the chart, where it was as the first finger landed. */
  private hold(): void {
    // Both fingers may land at once: then it hasn't moved yet.
    const scroller = this.scroller();
    const at =
      this.landedAt ??
      (scroller === undefined ? undefined : { scroller, left: scroller.scrollLeft });
    if (at === undefined || this.held !== undefined) {
      return;
    }
    this.held = at;
    at.scroller.style.overflowX = 'hidden';
    at.scroller.scrollLeft = at.left;
  }

  /** Lets it scroll again, from where it was held. */
  private release(): void {
    const at = this.held;
    if (at !== undefined) {
      at.scroller.style.overflowX = '';
      at.scroller.scrollLeft = at.left;
      this.held = undefined;
    }
  }

  /** The nearest element around the chart that scrolls sideways, if any. */
  private scroller(): HTMLElement | undefined {
    for (let at = this.host.parentElement; at !== null; at = at.parentElement) {
      const { overflowX } = getComputedStyle(at);
      if ((overflowX === 'auto' || overflowX === 'scroll') && at.scrollWidth > at.clientWidth) {
        return at;
      }
    }
    return undefined;
  }

  /** The window shown, all of the axis if not zoomed. */
  private window(): Range {
    return this.zoom() ?? this.whole();
  }

  /** Shows the window from `min`, `width` wide, within the axis: all of it once it's that wide. */
  private show(min: number, width: number): void {
    const whole = this.whole();
    const span = this.clampWidth(width);
    if (span >= whole.max - whole.min) {
      this.zoom.set(undefined);
      return;
    }
    const from = Math.min(whole.max - span, Math.max(whole.min, min));
    this.zoom.set({ min: from, max: from + span });
  }

  private clampWidth(width: number): number {
    const whole = this.whole().max - this.whole().min;
    return Math.min(whole, Math.max(whole * DEEPEST, width));
  }

  /** How far across the chart a point on the screen is, from 0 to 1. */
  private fraction(clientX: number): number {
    const box = this.host.getBoundingClientRect();
    return box.width > 0 ? Math.min(1, Math.max(0, (clientX - box.left) / box.width)) : 0.5;
  }

  /** Where two fingers on the chart are, between them, and how far apart: none unless just two. */
  private fingers(
    event: TouchEvent,
  ): { readonly middle: number; readonly distance: number } | undefined {
    const [first, second] = [event.touches[0], event.touches[1]];
    return event.touches.length !== 2 || first === undefined || second === undefined
      ? undefined
      : {
          middle: (first.clientX + second.clientX) / 2,
          distance: Math.abs(first.clientX - second.clientX),
        };
  }
}

/** How many pixels the wheel scrolled, however it counts: in pixels, lines or pages. */
function pixels(delta: number, mode: number): number {
  return mode === WheelEvent.DOM_DELTA_LINE
    ? delta * LINE
    : mode === WheelEvent.DOM_DELTA_PAGE
      ? delta * LINE * PAGE
      : delta;
}
