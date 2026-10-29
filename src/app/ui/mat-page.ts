import { Component, input } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatToolbar } from '@angular/material/toolbar';
import { injectBackToMenu } from './back-to-menu';

/**
 * A page opened from the main menu, built from Angular Material: a toolbar with a back button, the page's title and
 * what is marked `pageAction`, over its content in a column.
 */
@Component({
  selector: 'app-mat-page',
  imports: [MatToolbar, MatIconButton],
  host: { class: 'screen' },
  template: `
    <mat-toolbar>
      <button matIconButton type="button" aria-label="Back" (click)="back()">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
      </button>
      <h1>{{ heading() }}</h1>
      <ng-content select="[pageAction]" />
    </mat-toolbar>
    <main>
      <ng-content />
    </main>
  `,
  styles: `
    :host {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    mat-toolbar {
      gap: 0.5rem;
      padding-top: env(safe-area-inset-top);
      height: auto;
      min-height: 64px;
    }

    svg {
      width: 24px;
      height: 24px;
      fill: currentColor;
    }

    h1 {
      flex: 1;
      margin: 0;
      font: var(--mat-sys-title-large);
    }

    main {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
    }
  `,
})
export class MatPage {
  /** The page's title, in its toolbar. */
  readonly heading = input.required<string>();
  protected readonly back = injectBackToMenu();
}
