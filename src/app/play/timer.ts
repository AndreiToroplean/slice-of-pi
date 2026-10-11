import { InjectionToken } from '@angular/core';

/** Calls back again and again, to look whether the player has paused; tests replace it to play with time. */
export interface Timer {
  /** Calls `callback` every `period` milliseconds; the function returned stops it. */
  readonly every: (period: number, callback: () => void) => () => void;
}

export const TIMER = new InjectionToken<Timer>('TIMER', {
  factory: () => ({
    every: (period, callback) => {
      const id = setInterval(callback, period);
      return () => {
        clearInterval(id);
      };
    },
  }),
});
