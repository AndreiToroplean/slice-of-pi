import { Component, input } from '@angular/core';
import { injectBackToMenu } from '../menu/back-to-menu';

/**
 * A page opened from the main menu, scrolling under a frosted top bar that stays at its top: a back button, to the main
 * menu, the page's title, and in the top right corner what is marked `pageAction`, if anything. What else it contains
 * goes under the top bar, in a column.
 */
@Component({
  selector: 'app-page',
  host: { class: 'screen' },
  template: `
    <header class="top-bar">
      <button type="button" class="frosted back" aria-label="Back" (click)="back()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <h1>{{ title() }}</h1>
      <div class="actions"><ng-content select="[pageAction]" /></div>
    </header>
    <ng-content />
  `,
  styleUrl: './page.css',
})
export class Page {
  readonly title = input.required<string>();
  protected readonly back = injectBackToMenu();
}
