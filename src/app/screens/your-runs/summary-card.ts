import { Component } from '@angular/core';

/**
 * The card on top of a page of the runs, holding what is given to it: a white sheet, like the candy buttons, so it stands
 * out from the runs under it. About 45% as tall as the page under its top bar (4rem), its charts taking what the rest of
 * it leaves, about 13rem, and never less than 4rem.
 */
@Component({
  selector: 'app-summary-card',
  host: { class: 'panel summary' },
  template: `<ng-content />`,
  styles: `
    :host {
      flex: none;
      gap: 0.375rem;
      padding: 0.875rem var(--space-3) var(--space-3);
      --chart-height: max(4rem, (100dvh - 4rem) * 0.45 - 13rem);
      /* No shadow under the text on white. */
      --text-shadow: none;
      background: rgb(255 255 255 / 96%);
      box-shadow: 0 6px 24px rgb(30 20 60 / 22%);
      color: var(--ink);
    }
  `,
})
export class SummaryCard {}
