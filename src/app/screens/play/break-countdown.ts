import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { RunRecorder } from '../../player-data/run-recorder';
import { TIMER } from './timer';

/** How often the countdown is redrawn, in milliseconds: about every frame. */
const TICK = 16;

/**
 * Developer mode's countdown to the end of the group being typed, in the keypad's empty corner left of 0: the seconds
 * left before the pause is long enough for the break model to end it, to the millisecond, or +∞ if no pause would.
 */
@Component({
  selector: 'app-break-countdown',
  host: { 'aria-hidden': 'true' },
  template: `{{ text() }}`,
  styles: `
    :host {
      grid-row: 4;
      grid-column: 1;
      place-self: center;
      color: var(--on-background);
      opacity: 0.75;
      font-size: 0.9375rem;
      font-variant-numeric: tabular-nums;
      text-shadow: var(--text-shadow);
      pointer-events: none;
    }
  `,
})
export class BreakCountdown {
  /** How long after the last digit the group ends, in milliseconds: `Infinity` if no pause ends it. */
  readonly wait = input.required<number>();

  private readonly recorder = inject(RunRecorder);
  private readonly ticks = signal(0);
  protected readonly text = computed(() => {
    this.ticks();
    const wait = this.wait();
    return wait === Infinity
      ? '+∞'
      : (Math.max(0, wait - this.recorder.waited()) / 1000).toFixed(3);
  });

  constructor() {
    const stop = inject(TIMER).every(TICK, () => {
      this.ticks.update((ticks) => ticks + 1);
    });
    inject(DestroyRef).onDestroy(stop);
  }
}
