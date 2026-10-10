import { inject, InjectionToken, Service } from '@angular/core';
import { KeypadKey } from '../keypad/keypad-layout';
import { addKey, newRun, Run } from './run';
import { RunStore } from './run-store';

/** Where the recorder reads the time, and gets ids for new runs. */
export interface RunClock {
  /** A precise time in milliseconds, for the time between keys. */
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
 * Records the run being played, key by key, and saves it after every key so that leaving the game at any moment loses
 * nothing.
 *
 * A run starts with the first digit typed and ends when every digit typed is deleted again; the next digit starts a new
 * run. For now runs have no other end, until the game checks the digits (`groupings.md` §2).
 */
@Service()
export class RunRecorder {
  private readonly store = inject(RunStore);
  private readonly clock = inject(RUN_CLOCK);

  private run: Run | undefined;
  /** When the current run's first key was pressed, on the precise clock. */
  private start = 0;
  /** How many digits the current run has standing, after its backspaces. */
  private digits = 0;

  /** The latest record of each run not saved yet. */
  private readonly unsaved = new Map<string, Run>();
  private writing: Promise<void> | undefined;

  /** Records a key the player pressed. */
  record(key: KeypadKey): void {
    const now = this.clock.now();
    if (this.run === undefined) {
      if (key === 'backspace') {
        return;
      }
      this.run = newRun(this.clock.newId(), this.clock.epoch());
      this.start = now;
      this.digits = 0;
      void this.store.persist();
    }
    this.run = addKey(this.run, key, now - this.start);
    this.digits += key === 'backspace' ? -1 : 1;
    this.queue(this.run);
    if (this.digits === 0) {
      this.run = undefined;
    }
  }

  /** Resolves once every key recorded so far is saved. */
  async saved(): Promise<void> {
    while (this.writing !== undefined) {
      await this.writing;
    }
  }

  /** Saves the run, after the saves already under way. Saves of the same run in the meantime collapse into one. */
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
          await this.store.save(run);
        } catch (error) {
          console.error('Could not save the run.', error);
        }
      }
    }
    this.writing = undefined;
  }
}
