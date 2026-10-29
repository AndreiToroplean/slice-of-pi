import { FocusKeyManager } from '@angular/cdk/a11y';
import { afterNextRender, Component, ElementRef, inject } from '@angular/core';

/**
 * A list of buttons, one under the other, as in a game's menu: up and down move between them, round from either end,
 * as the CDK's focus key manager moves the focus, onto the first or the last when none of them has it. Tab stops on
 * only one of them before going on: the primary one, until the keyboard has been on another.
 */
@Component({
  selector: 'app-button-list',
  host: { '(focusin)': 'stopOn($event.target)', '(keydown)': 'move($event)' },
  template: '<ng-content />',
  styles: `
    :host {
      display: grid;
      gap: 0.875rem;
    }
  `,
})
export class ButtonList {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    afterNextRender(() => {
      const items = this.items();
      this.stopOn(items.find((item) => item.classList.contains('primary')) ?? items[0]);
    });
  }

  /** Makes Tab stop on this one of them, if it is one. */
  protected stopOn(target: EventTarget | null | undefined): void {
    const items = this.items();
    if (items.some((item) => item === target)) {
      for (const item of items) {
        item.tabIndex = item === target ? 0 : -1;
      }
    }
  }

  /** Moves the focus up or down from the one that has it. */
  protected move(event: KeyboardEvent): void {
    const items = this.items();
    const keys = new FocusKeyManager(
      items.map((item) => ({
        focus: () => {
          item.focus();
        },
      })),
    ).withWrap();
    keys.updateActiveItem(items.findIndex((item) => item.matches(':focus')));
    keys.onKeydown(event);
  }

  /** What within can take the focus, in order. */
  private items(): HTMLElement[] {
    return Array.from(
      this.host.querySelectorAll<HTMLElement>('a[href], button:enabled, input:enabled'),
    );
  }
}
