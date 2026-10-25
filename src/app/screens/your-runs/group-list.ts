import { Component, input } from '@angular/core';

/** A group of π's digits as the game plays it, and whether the break ending it is trusted. */
export interface ShownGroup {
  readonly start: number;
  readonly digits: string;
  readonly trusted: boolean;
}

/**
 * The groups of all runs, as words of digits; those past the trust horizon are dotted. However many there are, they take
 * at most `rows` rows, or without any, as much height as what holds it gives them, and scroll.
 */
@Component({
  selector: 'app-group-list',
  host: { '[class.fills]': 'rows() === undefined' },
  template: `
    <ul class="groups" aria-label="Your groups" tabindex="0" [style.--rows]="rows() ?? null">
      @for (group of groups(); track group.start) {
        <li [class.unsure]="!group.trusted">{{ group.digits }}</li>
      }
    </ul>
  `,
  styles: `
    ul {
      --row: 1.25rem;
      --row-gap: 0.25rem;
      display: flex;
      flex-wrap: wrap;
      gap: var(--row-gap) 0.5rem;
      max-height: calc(var(--rows) * var(--row) + (var(--rows) - 1) * var(--row-gap));
      overflow-y: auto;
      /* Only up and down: a swipe sideways goes on to the carousel holding it. */
      overscroll-behavior-y: contain;
      margin: 0.25rem 0 0;
      padding: 0;
      list-style: none;
      font-family: var(--font-digits);
      font-size: 0.875rem;
      font-weight: 500;
      line-height: var(--row);
      letter-spacing: 0.04em;

      &:focus-visible {
        outline: 0.1875rem solid var(--focus-ring);
        outline-offset: 0.125rem;
      }
    }

    /* As tall as what holds it gives it, never taller for its groups. */
    :host(.fills) {
      display: block;
      contain: size;
      min-height: 4rem;

      & ul {
        height: 100%;
        max-height: none;
        margin: 0;
      }
    }

    .unsure {
      opacity: 0.6;
      text-decoration: underline dotted;
      text-underline-offset: 0.2em;
    }
  `,
})
export class GroupList {
  readonly groups = input.required<readonly ShownGroup[]>();
  /** How many rows show before the groups scroll: as many as fit what holds it if none. */
  readonly rows = input<number | undefined>(3);
}
