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
 *
 * Only digits typed one after the other in the same turn of the player's are timed against each other: the first digit
 * of a turn, after the game's, keeps the interval it had when last typed straight after the digit before it, in an
 * earlier turn, as the time since the digit before, typed in an earlier turn too, would hold the game's turns between
 * them. The run's clock goes on from there, so that the whole run reads as if typed in one go.
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
  /** How far behind the clock the run's times are, in milliseconds: the time between turns left out. */
  private shift = 0;
  /** Whether the player has typed a digit in this turn of theirs. */
  private continuing = false;
  /** When the player's turn started, on the clock. */
  private turnStartedAt = 0;
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
    const index = place - start;
    const kept = { ...this.log, touches: this.log.touches.slice(0, index) } as TouchLog;
    const last = kept.touches.at(-1);
    if (!this.continuing && last !== undefined) {
      const typed = this.log.touches[index];
      // Always typed in an earlier turn, as the turn starts where the rounds do, which earlier ones went past; else the
      // time since the turn started.
      const interval =
        typed === undefined ? this.now() - this.turnStartedAt : typed.time - last.time;
      this.shift = this.now() - this.startedAt - (last.time + interval);
    }
    this.continuing = true;
    const log = addTouch(kept, touch, this.now() - this.startedAt - this.shift);
    this.log = log;
    this.writing = this.writing.then(async () => {
      try {
        await this.store.save(log);
      } catch (error) {
        console.error('Could not save the session.', error);
      }
    });
  }

  /** Starts a turn of the player's: its first digit isn't timed against the digit before it. */
  newTurn(): void {
    this.continuing = false;
    this.turnStartedAt = this.now();
  }

  /** Ends the session: the next digit starts a new run. */
  end(): void {
    this.log = undefined;
    this.shift = 0;
    this.continuing = false;
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
