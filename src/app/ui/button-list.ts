import { afterNextRender, Component, inject } from '@angular/core';
import { ArrowFocus } from './arrow-focus';

/**
 * A list of buttons, one under the other, as in a game's menu: up and down move between them, and Tab stops on only one
 * of them before going on: the primary one, until the keyboard has been on another.
 */
@Component({
  selector: 'app-button-list',
  hostDirectives: [ArrowFocus],
  host: { '(focusin)': 'stopOn($event.target)' },
  template: '<ng-content />',
  styles: `
    :host {
      display: grid;
      gap: 0.875rem;
    }
  `,
})
export class ButtonList {
  private readonly arrowFocus = inject(ArrowFocus, { self: true });

  constructor() {
    afterNextRender(() => {
      const items = this.arrowFocus.items();
      this.stopOn(items.find((item) => item.classList.contains('primary')) ?? items[0]);
    });
  }

  /** Makes Tab stop on this one of them, if it is one. */
  protected stopOn(target: EventTarget | null | undefined): void {
    const items = this.arrowFocus.items();
    if (items.some((item) => item === target)) {
      for (const item of items) {
        item.tabIndex = item === target ? 0 : -1;
      }
    }
  }
}
