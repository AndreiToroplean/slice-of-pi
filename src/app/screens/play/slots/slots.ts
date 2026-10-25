import { Component, computed, input } from '@angular/core';
import { slotLayout } from './slot-layout';

/**
 * The typing area: the slots of the group being typed, filled with its digits so far, the next one outlined,
 * each in its place color, or marked as a mistake (red on white, outlined in red). There is no text under the slots. Hidden from assistive technology: the typed digits say what
 * was typed.
 */
@Component({
  selector: 'app-slots',
  host: {
    'aria-hidden': 'true',
    '[style.--columns]': 'layout().columns',
  },
  template: `
    @for (slot of slots(); track $index) {
      <span
        class="slot"
        [class.filled]="slot !== null"
        [class.next]="$index === digits().length"
        [class.wrong]="slot !== null && $index >= digits().length - wrong()"
        [style.--place-color]="colors()[$index]"
        >{{ slot }}</span
      >
    }
  `,
  styleUrl: './slots.css',
})
export class Slots {
  /** The digits typed so far in the group being typed. */
  readonly digits = input.required<string>();
  /** Their place colors, in the same order. */
  readonly colors = input.required<readonly string[]>();
  /** The size of the group being typed. */
  readonly size = input.required<number>();
  /** How many of the last digits are mistakes. */
  readonly wrong = input(0);

  protected readonly layout = computed(() => slotLayout(this.digits().length, this.size()));

  /** Each slot's digit, or `null` while it's empty. */
  protected readonly slots = computed(() =>
    Array.from({ length: this.layout().count }, (_, i) => this.digits().charAt(i) || null),
  );
}
