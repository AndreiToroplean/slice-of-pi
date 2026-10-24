import { Component, input } from '@angular/core';

/**
 * What a candy button looks like: see-through, all alike, for buttons on the background that shouldn't stand out, such
 * as those in a screen's corners; or solid, white or in one of the game's candy colors.
 */
export type CandyLook = 'clear' | 'white' | 'primary' | 'danger';

/**
 * A candy button, the game's button (see `candy.css`): a button, a link, or a label for an input within it, such as
 * `<button appCandy="primary">`, white without a look. A mouse over a solid one picks it out, as the keyboard does
 * (see `App`).
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
  },
  template: '<ng-content />',
  styleUrl: './candy.css',
})
export class Candy {
  readonly look = input<CandyLook, CandyLook | ''>('white', {
    alias: 'appCandy',
    transform: (look) => look || 'white',
  });
}
