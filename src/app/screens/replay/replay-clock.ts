import { Timer } from '../play/timer';

/** A call waiting for its time on a {@link ReplayClock}. */
interface Waiting {
  readonly id: number;
  at: number;
  readonly callback: () => void;
  /** For a call repeated, the time between calls. */
  readonly period?: number;
}

/**
 * The clock a run is replayed on: its time, in milliseconds since the run's first digit, only moves when told to, and
 * calls back what waits for it as it passes, in order, at their own time.
 */
export class ReplayClock implements Timer {
  private time = 0;
  private waiting: Waiting[] = [];
  private ids = 0;

  /** The time on the clock. */
  now(): number {
    return this.time;
  }

  readonly after = (delay: number, callback: () => void): (() => void) =>
    this.wait({ id: ++this.ids, at: this.time + delay, callback });

  readonly every = (period: number, callback: () => void): (() => void) =>
    this.wait({ id: ++this.ids, at: this.time + period, callback, period: Math.max(period, 1) });

  /** Moves the clock on to `time`, calling back, at its own time, what waits until then. */
  advanceTo(time: number): void {
    for (;;) {
      const next = this.waiting.reduce<Waiting | undefined>(
        (first, waiting) => (first === undefined || waiting.at < first.at ? waiting : first),
        undefined,
      );
      if (next === undefined || next.at > time) {
        break;
      }
      this.time = Math.max(this.time, next.at);
      if (next.period === undefined) {
        this.cancel(next.id);
      } else {
        next.at += next.period;
      }
      next.callback();
    }
    this.time = Math.max(this.time, time);
  }

  /** Back to the start, at 0, forgetting what waits once; what repeats carries on, a period from then. */
  reset(): void {
    this.time = 0;
    this.waiting = this.waiting.flatMap((waiting) =>
      waiting.period === undefined ? [] : [{ ...waiting, at: waiting.period }],
    );
  }

  private wait(waiting: Waiting): () => void {
    this.waiting.push(waiting);
    return () => {
      this.cancel(waiting.id);
    };
  }

  private cancel(id: number): void {
    this.waiting = this.waiting.filter((waiting) => waiting.id !== id);
  }
}
