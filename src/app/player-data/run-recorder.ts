import { inject, InjectionToken, Service } from '@angular/core';
import { Tweaks } from '../developer-mode/tweaks';
import { KeypadTouch } from '../game/layers/keypad-layout';
import { KeypadLayoutSetting } from './keypad-layout-setting';
import { LiveRun, RunSession } from './live-run';
import { replay } from './run';
import { RunStore } from './run-store';
import { newTouchLog, TouchLog } from './touch-log';

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
 * Records the run being played, touch by touch, in its touch log, and saves it after every touch so that leaving the
 * game at any moment loses nothing.
 *
 * The run is the one its touch log records (see `replay` in `run.ts`): backspace deletes the last digit, and takes the
 * clock back to when the digit before it was typed, so the next digit's interval runs from the backspace; wrong digits
 * in a checked run are mistakes, left out.
 *
 * A run starts with the first digit typed and ends when the game restarts or ends: touches before it aren't kept.
 * Deleting every digit deletes the run, as if it had never started, and the next digit starts a new one (see
 * {@link LiveRun}). A run started without checking the digits, in developer mode, is marked unchecked, and each run
 * records the keypad layout it's played on.
 */
@Service()
export class RunRecorder implements RunSession {
  private readonly store = inject(RunStore);
  private readonly clock = inject(RUN_CLOCK);
  private readonly tweaks = inject(Tweaks);
  private readonly keypadLayout = inject(KeypadLayoutSetting);

  private readonly live = new LiveRun(
    () => this.clock.now(),
    () => {
      void this.store.persist();
      return newTouchLog(
        this.clock.newId(),
        this.clock.epoch(),
        this.tweaks.checking(),
        this.keypadLayout.layout(),
      );
    },
  );
  readonly run = this.live.run;

  /** The latest touch log of each run not saved yet. */
  private readonly unsaved = new Map<string, TouchLog>();
  private writing: Promise<void> | undefined;

  record(touch: KeypadTouch): void {
    const log = this.live.add(touch);
    if (log !== undefined) {
      this.queue(log);
    }
  }

  waited(): number {
    return this.live.waited();
  }

  end(): void {
    this.live.end();
  }

  pause(): void {
    this.live.pause();
  }

  resume(): void {
    this.live.resume();
  }

  /** Resolves once every key recorded so far is saved. */
  async saved(): Promise<void> {
    while (this.writing !== undefined) {
      await this.writing;
    }
  }

  /**
   * Saves a run's touch log, or deletes it if the run has no digits, after the saves already under way. Saves of the
   * same run in the meantime collapse into one.
   */
  private queue(log: TouchLog): void {
    this.unsaved.set(log.id, log);
    this.writing ??= this.write();
  }

  private async write(): Promise<void> {
    while (this.unsaved.size > 0) {
      const logs = [...this.unsaved.values()];
      this.unsaved.clear();
      for (const log of logs) {
        try {
          await (replay(log).run.digits === '' ? this.store.delete(log.id) : this.store.save(log));
        } catch (error) {
          console.error('Could not save the run.', error);
        }
      }
    }
    this.writing = undefined;
  }
}
