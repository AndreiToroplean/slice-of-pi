import { Component, computed, input } from '@angular/core';
import { nextSplitPlace } from './records';

/**
 * How far a record is from the next split place: the next goal, how far to go, to as many decimals as the record shows,
 * and a bar filling up to it.
 */
@Component({
  selector: 'app-next-goal',
  template: `
    <p>
      <span>Next: {{ goal() }}</span>
      <span class="to-go">{{ toGo() }} to go</span>
    </p>
    <div
      class="bar"
      role="progressbar"
      [attr.aria-label]="'To ' + goal()"
      aria-valuemin="0"
      [attr.aria-valuemax]="goal()"
      [attr.aria-valuenow]="value()"
    >
      <span class="fill" [style.width.%]="(100 * value()) / goal()"></span>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.5rem;
      padding: 0.875rem 1rem;
      border-radius: 1.25rem;
      background: var(--frost);
    }

    p {
      margin: 0;
      display: flex;
      justify-content: space-between;
      font-size: 0.875rem;
      text-shadow: var(--text-shadow);
    }

    .to-go {
      font-family: var(--font-digits);
      font-weight: 600;
    }

    .bar {
      height: 0.75rem;
      border-radius: 0.375rem;
      background: rgb(255 255 255 / 20%);
      overflow: hidden;
    }

    .fill {
      display: block;
      height: 100%;
      border-radius: 0.375rem;
      background: var(--candy-primary);
    }
  `,
})
export class NextGoal {
  /** The record, such as a number of places. */
  readonly value = input.required<number>();
  /** How many decimals the record shows. */
  readonly decimals = input(0);
  protected readonly goal = computed(() => nextSplitPlace(this.value()));
  protected readonly toGo = computed(() => (this.goal() - this.value()).toFixed(this.decimals()));
}
