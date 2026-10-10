import { inject, InjectionToken, Service } from '@angular/core';
import { KeypadKey } from '../keypad/keypad-layout';
import { addDigit, newRun, removeDigit, Run } from './run';
import { RunStore } from './run-store';

/** Where the recorder reads the time, and gets ids for new runs. */
export interface RunClock {
  /** A precise time in milliseconds, for the time between digits. */
  readonly now: () => number;
  /** The date and time, in milliseconds since the Unix epoch, for when a run started. */
  readonly epoch: () => number;
  readonly newId: () => string;
}

export const RUN_CLOCK = new InjectionToken<RunClock>('RUN_CLOCK', {
  factory: () => ({
    now: () => performance.now(),
    epoch: () => Date.now(),
    newId: () => crypto.randomUUID(),
  }),
});

/**
 * Records the run being played, digit by digit, and saves it after every key so that leaving the game at any moment
 * loses nothing.
 *
 * Backspace leaves no trace (see {@link Run}): it deletes the last digit's record and takes the clock back to when the
 * digit before it was typed, so the next digit's interval runs from the backspace.
 *
 * A run starts with the first digit typed. Deleting every digit deletes the run, as if it had never started, and the
 * next digit starts a new one. For now runs have no other end, until the game checks the digits (`groupings.md` §2).
 */
@Service()
export class RunRecorder {
  private readonly store = inject(RunStore);
  private readonly clock = inject(RUN_CLOCK);

  private run: Run | undefined;
  /** When the current run's first digit was typed, on the precise clock. */
  private start = 0;
  /** The time taken back by backspaces in the current run, in milliseconds. */
  private rewound = 0;

  /** The latest record of each run not saved yet; a run without digits is to be deleted. */
  private readonly unsaved = new Map<string, Run>();
  private writing: Promise<void> | undefined;

  /** Records a key the player pressed. */
  record(key: KeypadKey): void {
    const now = this.clock.now();
    if (key === 'backspace') {
      if (this.run === undefined) {
        return;
      }
      this.run = removeDigit(this.run);
      // The clock goes back to when the digit now last was typed.
      this.rewound = now - this.start - (this.run.times.at(-1) ?? 0);
      this.queue(this.run);
      if (this.run.digits === '') {
        this.run = undefined;
      }
      return;
    }
    if (this.run === undefined) {
      this.run = newRun(this.clock.newId(), this.clock.epoch());
      this.start = now;
      this.rewound = 0;
      void this.store.persist();
    }
    this.run = addDigit(this.run, key, now - this.start - this.rewound);
    this.queue(this.run);
  }

  /** Resolves once every key recorded so far is saved. */
  async saved(): Promise<void> {
    while (this.writing !== undefined) {
      await this.writing;
    }
  }

  /**
   * Saves the run, or deletes it if it has no digits, after the saves already under way. Saves of the same run in the
   * meantime collapse into one.
   */
  private queue(run: Run): void {
    this.unsaved.set(run.id, run);
    this.writing ??= this.write();
  }

  private async write(): Promise<void> {
    while (this.unsaved.size > 0) {
      const runs = [...this.unsaved.values()];
      this.unsaved.clear();
      for (const run of runs) {
        try {
          await (run.digits === '' ? this.store.delete(run.id) : this.store.save(run));
        } catch (error) {
          console.error('Could not save the run.', error);
        }
      }
    }
    this.writing = undefined;
  }
}
