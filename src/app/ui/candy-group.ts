import { Component, ViewEncapsulation } from '@angular/core';

/**
 * A candy button made of parts, side by side, each a candy button of its own (see `Candy`), and only those: what it
 * does, then, past a faint line, what's beside it, such as a place to drag up or down, or a small button opening a
 * dropdown (see `SplitButton`). Where they meet, their corners are square, and breathing never moves that line: each
 * part grows on its outer sides only. Picked out, one part or another, all of them breathe, but those pressed, and
 * shine as one: the sweep of light goes across the whole group, from one part on into the next.
 */
@Component({
  selector: 'app-candy-group',
  host: { class: 'candy-group' },
  template: '<ng-content />',
  // On the parts given, which are another component's.
  encapsulation: ViewEncapsulation.None,
  styles: `
    /* How far the shine has swept across the group, from 0 to 1 (see \`shine\` in \`styles.css\`). */
    @property --group-shine {
      syntax: '<number>';
      inherits: false;
      initial-value: 0;
    }

    /* Its width is the container's, for its parts to lay the shine across all of it. */
    .candy-group {
      container-type: inline-size;
      display: grid;
      grid-auto-flow: column;
      grid-template-columns: 1fr;
      grid-auto-columns: auto;
    }

    .candy-group > .candy:not(:last-child) {
      margin-inline-end: 0;
      padding-inline-end: var(--candy-padding-inline, 0.75rem);
      border-start-end-radius: 0;
      border-end-end-radius: 0;
    }

    .candy-group > .candy:not(:first-child) {
      margin-inline-start: 0;
      padding-inline-start: var(--candy-padding-inline, 0.75rem);
      border-start-start-radius: 0;
      border-end-start-radius: 0;
      border-inline-start: 1px solid rgb(40 20 60 / 18%);
    }

    .candy-group:has(:focus-visible) > .candy:not(.pressed, :active:not(.controlled)) {
      outline: 0.1875rem solid transparent;
      animation:
        breathe 0.6s var(--ease) infinite alternate,
        group-shine 2.4s ease-in-out infinite;
    }

    /*
     * The shine, two and a half times as wide as the group, sweeps from well before it to well past it, as on a button
     * alone: placed from the group's left edge on its first part, and from its right edge on the others, the last one,
     * each part's box reaching past them by as much as it has breathed out.
     */
    .candy-group > .candy {
      background-size: 250cqw 100%;
    }

    .candy-group > .candy:first-child {
      background-position: calc(-225cqw + 300cqw * var(--group-shine) + var(--grown)) 0;
    }

    .candy-group > .candy:not(:first-child) {
      background-position: right calc(75cqw - 300cqw * var(--group-shine) + var(--grown)) top 0;
    }

    @keyframes group-shine {
      60%,
      to {
        --group-shine: 1;
      }
    }

    /* Without motion, they stay grown. */
    @media (prefers-reduced-motion: reduce) {
      .candy-group:has(:focus-visible) > .candy {
        --candy-breath: 2;
      }
    }
  `,
})
export class CandyGroup {}
