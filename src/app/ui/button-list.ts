import { Component } from '@angular/core';

/** A list of buttons, one under the other, as in a game's menu. */
@Component({
  selector: 'app-button-list',
  template: '<ng-content />',
  styles: `
    :host {
      display: grid;
      gap: 0.875rem;
    }
  `,
})
export class ButtonList {}
