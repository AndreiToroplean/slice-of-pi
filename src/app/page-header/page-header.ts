import { Component, input } from '@angular/core';
import { injectBackToMenu } from '../menu/back-to-menu';

/**
 * The header of a page opened from the main menu: a back button, to the main menu, and the page's title. What it
 * contains goes in its top right corner, and then the header stays at the top while the page scrolls.
 */
@Component({
  selector: 'app-page-header',
  template: `
    <button type="button" class="frosted back" aria-label="Back" (click)="back()">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
    </button>
    <h1>{{ title() }}</h1>
    <div class="actions"><ng-content /></div>
  `,
  styleUrl: './page-header.css',
})
export class PageHeader {
  readonly title = input.required<string>();
  protected readonly back = injectBackToMenu();
}
