import { Component, input } from '@angular/core';

/**
 * A plain ⋮ button opening a menu given by its id (`DropdownMenu`'s), which the browser anchors to it: a visible way to
 * the actions a long press or a right click also opens, for whoever doesn't know of those, or can't do them, as on iOS.
 */
@Component({
  // A button itself, so that it can be the menu's `popovertarget`.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[appMore]',
  host: { type: 'button', '[attr.popovertarget]': 'menu()' },
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5.5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="18.5" r="2" />
    </svg>
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      width: 2.25rem;
      height: 2.25rem;
      padding: 0;
      border: none;
      border-radius: 0.8125rem;
      background: none;
      color: inherit;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    :host(:active) {
      background: var(--frost-pressed);
    }

    :host(:focus-visible) {
      outline: 0.1875rem solid var(--focus-ring);
      outline-offset: -0.1875rem;
    }

    svg {
      width: 1.25rem;
      height: 1.25rem;
      fill: currentColor;
      filter: drop-shadow(var(--text-shadow));
    }
  `,
})
export class MoreButton {
  /** The id of the menu it opens. */
  readonly menu = input.required<string>({ alias: 'appMore' });
}
