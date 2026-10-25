import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { LONGEST_WAIT } from '../../game/grouping/wait-to-end';
import { RunRecorder } from '../../player-data/run-recorder';
import { TIMER } from './timer';

/** How often the countdown is redrawn, in milliseconds: about every frame. */
const TICK = 16;

/**
 * Developer mode's countdown to the end of the group being typed, in the keypad's empty corner left of 0: the seconds
 * left before the pause is long enough for the break model to end it, or `> 10⁶` if no pause up to the longest wait
 * looked at would, as it can't tell that from none ever would, over a disk that empties as they run out.
 */
@Component({
  selector: 'app-break-countdown',
  host: { 'aria-hidden': 'true', '[style.--left]': 'share()' },
  template: `{{ text() }}`,
  styles: `
    :host {
      grid-row: 4;
      grid-column: 1;
      place-self: center;
      display: grid;
      place-items: center;
      width: 3.25rem;
      aspect-ratio: 1;
      border-radius: 50%;
      box-sizing: border-box;
      /* The share of the wait left, as a slice of a faint disk, emptying clockwise from the top, inside a faint ring. */
      border: 1px solid rgb(255 255 255 / 50%);
      background: conic-gradient(
        transparent calc((1 - var(--left)) * 1turn),
        rgb(255 255 255 / 30%) 0
      );
      color: var(--on-background);
      font-size: 0.8125rem;
      font-variant-numeric: tabular-nums;
      text-shadow: 0 1px 3px rgb(0 0 0 / 35%);
      pointer-events: none;
    }
  `,
})
export class BreakCountdown {
  /** How long after the last digit the group ends, in milliseconds: `Infinity` if no pause looked at ends it. */
  readonly wait = input.required<number>();

  private readonly recorder = inject(RunRecorder);
  private readonly ticks = signal(0);
  /** How long is left, in milliseconds. */
  private readonly left = computed(() => {
    this.ticks();
    return Math.max(0, this.wait() - this.recorder.waited());
  });
  /** The share of the wait left, from 1 down to 0. */
  protected readonly share = computed(() => {
    const wait = this.wait();
    return wait === Infinity ? 1 : wait > 0 ? this.left() / wait : 0;
  });
  protected readonly text = computed(() =>
    this.wait() === Infinity
      ? `> 10${superscript(Math.log10(LONGEST_WAIT / 1000))}`
      : seconds(this.left()),
  );

  constructor() {
    const stop = inject(TIMER).every(TICK, () => {
      this.ticks.update((ticks) => ticks + 1);
    });
    inject(DestroyRef).onDestroy(stop);
  }
}

/** Milliseconds as seconds, to the tenth, as a power of ten from 1000 s on: `5.2`, `3.4·10⁶`. */
export function seconds(milliseconds: number): string {
  const value = milliseconds / 1000;
  if (Number(value.toFixed(1)) < 1000) {
    return value.toFixed(1);
  }
  let exponent = Math.floor(Math.log10(value));
  let mantissa = (value / 10 ** exponent).toFixed(1);
  if (mantissa === '10.0') {
    exponent++;
    mantissa = '1.0';
  }
  return `${mantissa}·10${superscript(exponent)}`;
}

/** A whole number in superscript digits: `6` is `⁶`. */
function superscript(value: number): string {
  return String(value).replace(/\d/g, (digit) => SUPERSCRIPTS[Number(digit)] ?? '');
}

const SUPERSCRIPTS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
