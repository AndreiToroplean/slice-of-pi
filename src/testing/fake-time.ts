import { Provider } from '@angular/core';
import { TIMER } from '../app/play/timer';
import { RUN_CLOCK } from '../app/runs/run-recorder';

/** A clock that only moves when told to, for the run recorder and the timers of the play screen. */
export class FakeTime {
  /** The time, in milliseconds. */
  now = 0;
  private ids = 0;
  private pending: { at: number; period: number; callback: () => void }[] = [];

  readonly providers: Provider[] = [
    {
      provide: RUN_CLOCK,
      useValue: {
        now: () => this.now,
        epoch: () => 1_760_000_000_000 + this.now,
        newId: () => `run-${String(++this.ids)}`,
      },
    },
    {
      provide: TIMER,
      useValue: {
        every: (period: number, callback: () => void) => {
          const timer = { at: this.now + period, period, callback };
          this.pending.push(timer);
          return () => {
            this.pending = this.pending.filter((other) => other !== timer);
          };
        },
      },
    },
  ];

  /** Moves the time on, calling back the timers each time they're due by then, in order. */
  advance(milliseconds: number): void {
    const end = this.now + milliseconds;
    for (;;) {
      const next = this.pending
        .filter((timer) => timer.at <= end)
        .sort((a, b) => a.at - b.at)
        .at(0);
      if (next === undefined) {
        break;
      }
      this.now = next.at;
      next.at += next.period;
      next.callback();
    }
    this.now = end;
  }
}
