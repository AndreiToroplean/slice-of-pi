import { InjectionToken } from '@angular/core';

/** Calls back later, to end a group once the player has paused, or to redraw; tests replace it to play with time. */
export interface Timer {
  /** Calls `callback` once, `delay` milliseconds from now; the function returned cancels it. */
  readonly after: (delay: number, callback: () => void) => () => void;
  /** Calls `callback` every `period` milliseconds; the function returned stops it. */
  readonly every: (period: number, callback: () => void) => () => void;
}

export const TIMER = new InjectionToken<Timer>('TIMER', {
  factory: () => ({
    after: (delay, callback) => {
      const id = setTimeout(callback, delay);
      return () => {
        clearTimeout(id);
      };
    },
    every: (period, callback) => {
      const id = setInterval(callback, period);
      return () => {
        clearInterval(id);
      };
    },
  }),
});
