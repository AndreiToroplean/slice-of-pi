import { DestroyRef, Directive, inject, output } from '@angular/core';

/** How long an element is held, without moving, to count as a long press. */
export const LONG_PRESS_MS = 500;
/** How far the finger may wander while holding, in pixels, before the long press is given up. */
export const LONG_PRESS_SLOP = 10;

/**
 * A long press on an element: holding it still for {@link LONG_PRESS_MS}, or what the browser takes for a request for
 * its context menu (a right click, the keyboard's menu key or, on some phones, the long press itself), which the app
 * otherwise ignores. Either way, it's told once per press.
 */
@Directive({
  selector: '[appLongPress]',
  host: {
    '(pointerdown)': 'down($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'end()',
    '(pointercancel)': 'end()',
    '(contextmenu)': 'contextMenu()',
  },
})
export class LongPress {
  readonly appLongPress = output();

  private timer: ReturnType<typeof setTimeout> | undefined;
  private start = { x: 0, y: 0 };
  /** Whether the hold was already told, so that a context menu for the same press doesn't tell it again. */
  private told = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.cancel();
    });
  }

  protected down(event: PointerEvent): void {
    this.end();
    if (event.button !== 0) {
      return;
    }
    this.start = { x: event.clientX, y: event.clientY };
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.tell();
    }, LONG_PRESS_MS);
  }

  protected move(event: PointerEvent): void {
    if (
      this.timer !== undefined &&
      Math.hypot(event.clientX - this.start.x, event.clientY - this.start.y) > LONG_PRESS_SLOP
    ) {
      this.cancel();
    }
  }

  protected end(): void {
    this.cancel();
    this.told = false;
  }

  protected contextMenu(): void {
    if (!this.told) {
      this.cancel();
      this.tell();
    }
  }

  private cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private tell(): void {
    this.told = true;
    this.appLongPress.emit();
  }
}
