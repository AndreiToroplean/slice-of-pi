import { Component, computed, input } from '@angular/core';
import { slotLayout } from './slot-layout';

/**
 * The typing area: the slots of the group being typed, filled with its digits so far, the next one outlined
 * (`groupings.md` §3). There is no text under the slots. Hidden from assistive technology: the typed digits say what
 * was typed.
 */
@Component({
  selector: 'app-slots',
  host: {
    'aria-hidden': 'true',
    '[class.dense]': 'layout().dense',
    '[style.--columns]': 'layout().columns',
  },
  template: `
    @for (slot of slots(); track $index) {
      <span class="slot" [class.filled]="slot !== null" [class.next]="$index === digits().length">{{
        slot
      }}</span>
    }
  `,
  styleUrl: './slots.css',
})
export class Slots {
  /** The digits typed so far in the group being typed. */
  readonly digits = input.required<string>();
  /** How many digits the group is expected to have. */
  readonly hint = input.required<number>();

  protected readonly layout = computed(() => slotLayout(this.digits().length, this.hint()));

  /** Each slot's digit, or `null` while it's empty. */
  protected readonly slots = computed(() =>
    Array.from({ length: this.layout().count }, (_, i) => this.digits().charAt(i) || null),
  );
}
