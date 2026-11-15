import { CdkMenuTrigger } from '@angular/cdk/menu';
import { Component, inject } from '@angular/core';
import { MORE_POSITIONS } from './menu';
import { Icon } from './icon';

/**
 * A ⋮ button opening the menu given to it (an `ng-template` holding an `appDropdown`), with what's in `appMoreData`: a
 * visible way to the actions a long press or a right click also opens, for whoever doesn't know of those, or can't do
 * them, as on iOS.
 */
@Component({
  // A button itself, as the menu's trigger.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[appMore]',
  hostDirectives: [
    {
      directive: CdkMenuTrigger,
      inputs: ['cdkMenuTriggerFor: appMore', 'cdkMenuTriggerData: appMoreData'],
    },
  ],
  host: { type: 'button' },
  imports: [Icon],
  template: `<app-icon name="more" />`,
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

    app-icon {
      font-size: 1.25rem;
      filter: drop-shadow(var(--text-shadow));
    }
  `,
})
export class MoreButton {
  constructor() {
    inject(CdkMenuTrigger, { self: true }).menuPosition = MORE_POSITIONS;
  }
}
