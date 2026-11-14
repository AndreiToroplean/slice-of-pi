import { Timer } from './timer';

/** A call waiting on a {@link ScaledTimer}. */
interface Waiting {
  /** How long it has left to wait, in the scaled time, as of `since`. */
  left: number;
  /** When it was last scheduled, in milliseconds of the clock. */
  since: number;
  /** Cancels it on the timer it's scheduled on. */
  stop: () => void;
  readonly callback: () => void;
}

/**
 * Calls back later in a time that runs at a rate, faster or slower than the clock's, or not at all, which can change
 * while calls wait, those waiting then going on for what's left of their wait at the new rate: as when the player fast
 * forwards what Discovery's game plays, or holds it.
 */
export class ScaledTimer {
  private rate = 1;
  private readonly waiting = new Set<Waiting>();
  /** The time, as of the clock's `since`, when the rate last changed. */
  private base = { time: 0, since: 0 };

  constructor(
    private readonly timer: Timer,
    private readonly now: () => number,
  ) {
    this.base = { time: 0, since: this.now() };
  }

  /** The time, in milliseconds, as it runs at its rate. */
  time(): number {
    return this.base.time + (this.now() - this.base.since) * this.rate;
  }

  /** Calls `callback` once, `delay` milliseconds of the scaled time from now; the function returned cancels it. */
  after(delay: number, callback: () => void): () => void {
    const waiting: Waiting = { left: delay, since: this.now(), stop: () => undefined, callback };
    this.waiting.add(waiting);
    this.schedule(waiting);
    return () => {
      waiting.stop();
      this.waiting.delete(waiting);
    };
  }

  /** Sets how many times faster than the clock's the time runs, from now on, for the calls waiting too. */
  setRate(rate: number): void {
    if (rate === this.rate) {
      return;
    }
    const now = this.now();
    this.base = { time: this.time(), since: now };
    for (const waiting of this.waiting) {
      waiting.stop();
      waiting.left = Math.max(0, waiting.left - (now - waiting.since) * this.rate);
      waiting.since = now;
    }
    this.rate = rate;
    for (const waiting of this.waiting) {
      this.schedule(waiting);
    }
  }

  private schedule(waiting: Waiting): void {
    if (this.rate === 0) {
      waiting.stop = () => undefined;
      return;
    }
    waiting.stop = this.timer.after(waiting.left / this.rate, () => {
      this.waiting.delete(waiting);
      waiting.callback();
    });
  }
}
