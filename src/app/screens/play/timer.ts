import { InjectionToken } from '@angular/core';

/** Calls back later, to end a group once the player has paused; tests replace it to play with time. */
export interface Timer {
  /** Calls `callback` once, `delay` milliseconds from now; the function returned cancels it. */
  readonly after: (delay: number, callback: () => void) => () => void;
}

export const TIMER = new InjectionToken<Timer>('TIMER', {
  factory: () => ({
    after: (delay, callback) => {
      const id = setTimeout(callback, delay);
      return () => {
        clearTimeout(id);
      };
    },
  }),
});
