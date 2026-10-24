import { Component, DestroyRef, inject, input, signal } from '@angular/core';

/**
 * What a candy button looks like: see-through, all alike, for buttons on the background that shouldn't stand out, such
 * as those in a screen's corners; or solid, white or in one of the game's candy colors.
 */
export type CandyLook = 'clear' | 'white' | 'primary' | 'danger';

/** How long a press shows at least, however quick, in ms: long enough to sink all the way. */
export const SHORTEST_PRESS = 150;

/**
 * A candy button, the game's button (see `candy.css`): a button, a link, or a label for an input within it, such as
 * `<button appCandy="primary">`, white without a look. A mouse over a solid one picks it out, as the keyboard does
 * (see `App`), unless it can't take the focus, as keys typed from the keyboard's own keys needn't. Pressed, it sinks
 * into its edge, for `SHORTEST_PRESS` at least, even if what it opens shows at once; given a press color, its edge
 * shows it, and pressing fills its face with it.
 */
@Component({
  // On the native elements themselves, which keep all they do: an attribute rather than an element of its own.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[appCandy], a[appCandy], label[appCandy]',
  host: {
    class: 'candy',
    '[class.clear]': "look() === 'clear'",
    '[class.primary]': "look() === 'primary'",
    '[class.danger]': "look() === 'danger'",
    '[class.unfocusable]': '!focusable()',
    '[attr.tabindex]': 'focusable() ? null : -1',
    '[class.pressed]': 'pressed() ?? held()',
    '[class.colored]': 'pressColor() !== undefined',
    '[style.--press-color]': 'pressColor()',
    '(pointerdown)': 'hold()',
    '(document:pointerup)': 'letGo()',
    '(document:pointercancel)': 'letGo()',
  },
  template: '<ng-content />',
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
   * Otherwise, it shows pressed while pressed.
   */
  readonly pressed = input<boolean>();

  /** Whether it's pressed, or was a moment ago. */
  protected readonly held = signal(false);
  private heldSince = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
    });
  }

  protected hold(): void {
    clearTimeout(this.timer);
    this.held.set(true);
    this.heldSince = performance.now();
  }

  /** Lets go, once it has shown pressed long enough. */
  protected letGo(): void {
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
