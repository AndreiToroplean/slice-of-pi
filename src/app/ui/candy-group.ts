import { Component, DestroyRef, ElementRef, inject, ViewEncapsulation } from '@angular/core';
import { breatheEvenly } from './breath';

/**
 * A candy button made of parts, side by side, each a candy button of its own (see `Candy`), and only those: what it
 * does, then, past a faint line, what's beside it, such as a place to drag up or down, or a small button opening a
 * dropdown (see `SplitButton`). Where they meet, their corners are square. Picked out, one part or another, it breathes
 * as one button, its parts with it, unless one is pressed, and they shine as one: the sweep of light goes across the
 * whole group, from one part on into the next.
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

    /*
     * Its width is the container's, for its parts to lay the shine across all of it. It breathes as a candy button does,
     * by its own width (see \`Candy\`).
     */
    .candy-group {
      container-type: inline-size;
      display: grid;
      grid-auto-flow: column;
      grid-template-columns: 1fr;
      grid-auto-columns: auto;
      scale: calc(1 + var(--candy-breath) / 3 * var(--breath, 3) * var(--candy-breath-step, 0));
    }

    .candy-group > .candy:not(:last-child) {
      border-start-end-radius: 0;
      border-end-end-radius: 0;
    }

    .candy-group > .candy:not(:first-child) {
      border-start-start-radius: 0;
      border-end-start-radius: 0;
      border-inline-start: 1px solid rgb(40 20 60 / 18%);
    }

    .candy-group:has(:focus-visible):not(:has(> .pressed, > .candy:active:not(.controlled))) {
      animation: breathe 0.6s var(--ease) infinite alternate;
    }

    /* Its parts don't breathe on their own, but shine, those not pressed. */
    .candy-group:has(:focus-visible) > .candy:not(.pressed, :active:not(.controlled)) {
      outline: 0.1875rem solid transparent;
      animation: group-shine 2.4s ease-in-out infinite;
    }

    /*
     * The shine, two and a half times as wide as the group, sweeps from well before it to well past it, as on a button
     * alone: placed from the group's left edge on its first part, and from its right edge on the others, the last one.
     */
    .candy-group > .candy {
      background-size: 250cqw 100%;
    }

    /* Its parts breathe with it, never on their own, even held grown without motion. */
    .candy-group > .candy {
      scale: none;
    }

    .candy-group > .candy:first-child {
      background-position: calc(-225cqw + 300cqw * var(--group-shine)) 0;
    }

    .candy-group > .candy:not(:first-child) {
      background-position: right calc(75cqw - 300cqw * var(--group-shine)) top 0;
    }

    @keyframes group-shine {
      60%,
      to {
        --group-shine: 1;
      }
    }

    /* Without motion, it stays grown. */
    @media (prefers-reduced-motion: reduce) {
      .candy-group:has(:focus-visible) {
        --candy-breath: 2;
      }
    }
  `,
})
export class CandyGroup {
  constructor() {
    breatheEvenly(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement, inject(DestroyRef));
  }
}
