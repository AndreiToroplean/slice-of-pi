import { inject, Injectable } from '@angular/core';
import { KeypadTouch } from '../game/layers/keypad-layout';
import { KeypadLayoutSetting } from './keypad-layout-setting';
import { RUN_CLOCK } from './run-recorder';
import { RunStore } from './run-store';
import { addTouch, newTouchLog, TouchLog } from './touch-log';

/**
 * Records a Discover session as one run, which keeps only the latest typing of each place (`recording: 'overwrite'`),
 * as its rounds go over the same places again and again: each right digit typed takes its place's touch over, and
 * drops those of the places after it, typed in an earlier round, so that the touches stay in order of time. Wrong
 * digits aren't kept: they end the session. Saved after every digit, so that leaving at any moment loses nothing. Its
 * clock stops while the game is paused.
 */
@Injectable()
export class DiscoverRecorder {
  private readonly store = inject(RunStore);
  private readonly clock = inject(RUN_CLOCK);
  private readonly keypadLayout = inject(KeypadLayoutSetting);

  /** The touch log of the session, from its first digit. */
  private log: TouchLog | undefined;
  /** When its first digit was typed, on the clock. */
  private startedAt = 0;
  /** How long the clock has been stopped, in milliseconds, and since when, while it is. */
  private stopped = 0;
  private stoppedAt: number | undefined;
  private writing: Promise<void> = Promise.resolve();

  /**
   * Records a right digit typed at a place, of a session starting from `start`: its touch takes the place's over, those
   * of the places after it dropped.
   */
  record(touch: KeypadTouch, place: number, start: number): void {
    if (this.log === undefined) {
      void this.store.persist();
      this.startedAt = this.now();
      this.log = newTouchLog(
        this.clock.newId(),
        this.clock.epoch(),
        true,
        this.keypadLayout.layout(),
        {
          start,
          recording: 'overwrite',
        },
      );
    }
    const kept = { ...this.log, touches: this.log.touches.slice(0, place - start) } as TouchLog;
    const log = addTouch(kept, touch, this.now() - this.startedAt);
    this.log = log;
    this.writing = this.writing.then(async () => {
      try {
        await this.store.save(log);
      } catch (error) {
        console.error('Could not save the session.', error);
      }
    });
  }

  /** Ends the session: the next digit starts a new run. */
  end(): void {
    this.log = undefined;
  }

  /** Stops the clock, as while the game is paused. */
  pause(): void {
    this.stoppedAt ??= this.clock.now();
  }

  /** Starts the clock again, from where it stopped. */
  resume(): void {
    if (this.stoppedAt !== undefined) {
      this.stopped += this.clock.now() - this.stoppedAt;
      this.stoppedAt = undefined;
    }
  }

  /** Resolves once every digit recorded so far is saved. */
  saved(): Promise<void> {
    return this.writing;
  }

  /** The clock, less the time it was stopped. */
  private now(): number {
    return (this.stoppedAt ?? this.clock.now()) - this.stopped;
  }
}
