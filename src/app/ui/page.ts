import { Component, DOCUMENT, inject, input } from '@angular/core';
import { injectBackToMenu } from './back-to-menu';
import { Candy } from './candy';

/**
 * A page opened from the main menu, scrolling under a frosted top bar that stays at its top: a back button, to the main
 * menu, the page's title, and in the top right corner what is marked `pageAction`, if anything. What else it contains
 * goes under the top bar, in a column. Escape goes back to the main menu too.
 */
@Component({
  selector: 'app-page',
  imports: [Candy],
  host: { class: 'screen', '(document:keydown.escape)': 'escape($event)' },
  template: `
    <header class="top-bar">
      <button type="button" appCandy="clear" class="corner back" title="Back" (click)="back()">
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
  private readonly document = inject(DOCUMENT);

  /** Back to the main menu, unless the Escape closes an open dialog or menu, as the browser does with it. */
  protected escape(event: Event): void {
    if (
      !event.defaultPrevented &&
      this.document.querySelector('dialog[open], :popover-open') === null
    ) {
      event.preventDefault();
      this.back();
    }
  }
}
