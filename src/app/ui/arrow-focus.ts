import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Up and down move the focus through the buttons and links within, as through a game's menu, round from either end:
 * onto the first or the last when none of them has it.
 */
@Directive({
  selector: '[appArrowFocus]',
  host: {
    '(keydown.arrowup)': 'move($event, -1)',
    '(keydown.arrowdown)': 'move($event, 1)',
  },
})
export class ArrowFocus {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Gives the focus to the first of them. */
  focusFirst(): void {
    this.items()[0]?.focus();
  }

  /** Moves the focus `step` of them on (back if negative), unless a group within took the key. */
  protected move(event: Event, step: number): void {
    if (event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    const items = this.items();
    const focused = items.findIndex((item) => item.matches(':focus'));
    items.at(focused === -1 ? Math.min(step, 0) : (focused + step) % items.length)?.focus();
  }

  /** What within can take the focus, in order. */
  items(): HTMLElement[] {
    return Array.from(
      this.host.querySelectorAll<HTMLElement>('a[href], button:enabled, input:enabled'),
    );
  }
}
