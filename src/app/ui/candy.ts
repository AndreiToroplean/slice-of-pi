import { Component, DestroyRef, ElementRef, inject, input, signal } from '@angular/core';
import { breatheEvenly } from './breath';

/**
 * What a candy button looks like: see-through, all alike, for buttons on the background that shouldn't stand out, such
 * as those in a screen's corners; or solid, white or in one of the game's candy colors.
 */
export type CandyLook = 'clear' | 'white' | 'primary' | 'danger';

/** How long a press shows at least, however quick, in ms: long enough to sink all the way. */
export const SHORTEST_PRESS = 150;
/** How far a touch on one that waits to tell a swipe from a press may wander and still be a press, in CSS pixels. */
export const SWIPE_SLOP = 6;

/**
 * A candy button, the game's button (see `candy.css`): a button, a link, a label for an input within it, or a box for
 * another control within it, such as a spinner, such as
 * `<button appCandy="primary">`, white without a look. A mouse over a solid one picks it out, as the keyboard does
 * (see `App`), unless it can't take the focus, as keys typed from the keyboard's own keys needn't. Pressed, it sinks
 * into its edge, for `SHORTEST_PRESS` at least, even if what it opens shows at once. Given a press color, a see-through
 * one's edge shows it, and pressing fills its face with it; a solid one is in that color, on a darker edge. Where a
 * touch on it may be a swipe, as on one the browser scrolls, it waits a moment to show a press, and shows none for a
 * swipe: a touch that wanders, or that the browser takes over to scroll; let go before then, it shows the press at
 * once, as long as any.
 */
@Component({
  // On the native elements themselves, which keep all they do: an attribute rather than an element of its own.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[appCandy], a[appCandy], label[appCandy], div[appCandy]',
  exportAs: 'appCandy',
  host: {
    class: 'candy',
    '[class.clear]': "look() === 'clear'",
    '[class.primary]': "look() === 'primary'",
    '[class.danger]': "look() === 'danger'",
    '[class.unfocusable]': '!focusable()',
    '[attr.tabindex]': 'focusable() ? null : -1',
    '[class.pressed]': 'pressed() ?? held()',
    '[class.controlled]': 'pressed() !== undefined || swipeWait() > 0',
    '[class.colored]': 'pressColor() !== undefined',
    '[style.--press-color]': 'pressColor()',
    '(pointerdown)': 'hold($event)',
    '(pointermove)': 'wander($event)',
    '(document:pointerup)': 'letGo()',
    '(document:pointercancel)': 'cancel()',
  },
  template: '<span class="content"><ng-content /></span>',
  styleUrl: './candy.css',
})
export class Candy {
  readonly look = input<CandyLook, CandyLook | ''>('white', {
    alias: 'appCandy',
    transform: (look) => look || 'white',
  });
  /** Whether it can take the focus. */
  readonly focusable = input(true);
  /** The color its edge shows, and its face is filled with while pressed, if any. */
  readonly pressColor = input<string>();
  /**
   * Whether it shows pressed, when what presses it is handled elsewhere, such as keys typed from the keyboard.
   * Otherwise, it shows pressed while pressed. Told, it shows only that, even while the browser holds it active, as
   * with a mouse dragged off it.
   */
  readonly pressed = input<boolean>();
  /**
   * How long it waits, in ms, to tell whether a touch is a swipe, which shows no press, before it shows one: none, unless
   * a touch on it may be a swipe. Waiting, it never shows the browser's own press, which doesn't.
   */
  readonly swipeWait = input(0);

  /** Whether it's pressed, or was a moment ago: for a button it's part of to show pressed along with it. */
  readonly held = signal(false);
  private heldSince = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Where the touch it waits to tell a swipe from a press of started, while it waits. */
  private waiting: { readonly x: number; readonly y: number } | undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);
    breatheEvenly(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement, destroyRef);
    destroyRef.onDestroy(() => {
      clearTimeout(this.timer);
    });
  }

  protected hold(event: Event): void {
    clearTimeout(this.timer);
    const wait = this.swipeWait();
    if (wait > 0) {
      const { clientX, clientY } = event as PointerEvent;
      this.waiting = { x: clientX, y: clientY };
      this.timer = setTimeout(() => {
        this.waiting = undefined;
        this.press();
      }, wait);
    } else {
      this.press();
    }
  }

  /** Shows it pressed. */
  private press(): void {
    this.held.set(true);
    this.heldSince = performance.now();
  }

  /** A touch it waits on that wanders is a swipe, which shows no press. */
  protected wander(event: Event): void {
    const from = this.waiting;
    const { clientX, clientY } = event as PointerEvent;
    if (from !== undefined && Math.hypot(clientX - from.x, clientY - from.y) > SWIPE_SLOP) {
      this.stopWaiting();
    }
  }

  /** A touch the browser takes over, as to scroll, lets go, and while it waits, is a swipe, which shows no press. */
  protected cancel(): void {
    if (this.waiting !== undefined) {
      this.stopWaiting();
    } else {
      this.letGo();
    }
  }

  private stopWaiting(): void {
    clearTimeout(this.timer);
    this.waiting = undefined;
  }

  /** Lets go, once it has shown pressed long enough: let go while it waits, it shows the press at once. */
  protected letGo(): void {
    if (this.waiting !== undefined) {
      this.stopWaiting();
      this.press();
    }
    if (!this.held()) {
      return;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(
      () => {
        this.held.set(false);
      },
      Math.max(0, SHORTEST_PRESS - (performance.now() - this.heldSince)),
    );
  }
}
