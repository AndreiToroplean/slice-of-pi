import { DestroyRef, Directive, inject, output } from '@angular/core';

/**
 * A request for an element's context menu, as the browser tells it: a long press on Android, as long as the system
 * has it, a right click, or the keyboard's menu key. Its own menu never opens (see `App`). It's told where it was, in
 * window coordinates. A mouse held down is no long press: it's a click. iOS tells no long press to web pages, so what
 * a context menu holds needs another way to it too, such as a ⋮ button (`MoreButton`).
 *
 * Some systems ask for it as a mouse button goes down, and the browser closes a menu where that button is let go, as
 * on a click outside it: then it's told once the button is up.
 */
@Directive({
  selector: '[appContextMenu]',
  host: {
    '(pointerdown)': 'down($event)',
    '(document:pointerup)': 'up()',
    '(contextmenu)': 'request($event)',
  },
})
export class ContextMenu {
  readonly appContextMenu = output<{ readonly x: number; readonly y: number }>();

  /** Whether a mouse button pressed on it is still down. */
  private held = false;
  /** Where the menu was asked for while a mouse button was down, to tell once it's up. */
  private pending: { readonly x: number; readonly y: number } | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
    });
  }

  protected down(event: PointerEvent): void {
    this.held = event.pointerType === 'mouse';
    this.pending = undefined;
  }

  protected up(): void {
    this.held = false;
    const at = this.pending;
    if (at !== undefined) {
      this.pending = undefined;
      // After the browser is done with the button let go, which would close the menu.
      this.timer = setTimeout(() => {
        this.appContextMenu.emit(at);
      });
    }
  }

  protected request(event: MouseEvent): void {
    const at = { x: event.clientX, y: event.clientY };
    if (this.held) {
      this.pending = at;
    } else {
      this.appContextMenu.emit(at);
    }
  }
}
