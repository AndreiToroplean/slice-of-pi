import { Component, computed, input } from '@angular/core';
import { Tape } from './tape';

/**
 * How many recent digits the tape keeps. Older digits are dropped from the DOM; the tape is never wider than this many
 * cells and fades out towards its left end, so dropped digits are already invisible.
 */
export const TAPE_CAPACITY = 24;

/** Shows the typed digits in a row whose newest digit sits at the center, pushing older ones to the left. */
@Component({
  selector: 'app-digit-tape',
  host: {
    '[style.--capacity]': 'capacity',
  },
  template: `
    <div class="tape" aria-hidden="true">
      @for (entry of tape().recent; track entry.position) {
        <span class="digit" [style.--offset]="entry.position - newestPosition()">{{
          entry.digit
        }}</span>
      }
    </div>
    <p class="visually-hidden">{{ summary() }}</p>
  `,
  styleUrl: './digit-tape.css',
})
export class DigitTape {
  readonly tape = input.required<Tape>();

  protected readonly capacity = TAPE_CAPACITY;
  protected readonly newestPosition = computed(() => this.tape().count - 1);
  protected readonly summary = computed(() => {
    const tape = this.tape();
    const newest = tape.recent.at(-1);
    return newest === undefined
      ? 'No digits typed yet.'
      : `${String(tape.count)} digits typed, the last one is ${newest.digit}.`;
  });
}
