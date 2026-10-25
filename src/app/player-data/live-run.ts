import { computed, signal, Signal } from '@angular/core';
import { KeypadTouch } from '../game/layers/keypad-layout';
import { replay, Run } from './run';
import { addTouch, TouchLog } from './touch-log';

/** The run being played, as the play screen sees it: what it records each touch in. */
export interface RunSession {
  /** The run being played, as recorded so far; `undefined` until its first digit is kept. */
  readonly run: Signal<Run | undefined>;
  /** Records a touch on the keypad, or a key typed, whatever it typed. */
  record(touch: KeypadTouch): void;
  /** How long it's been since the last digit of the current run, in milliseconds, on the run's clock. */
  waited(): number;
  /** Ends the current run, as kept so far: the next digit starts a new run. */
  end(): void;
}

/**
 * The run being played, kept in memory as its touch log grows, touch by touch: the run is the one it records (see
 * {@link replay}).
 *
 * A run starts with the first digit typed, in a touch log `begin` gives, and ends when told to: touches before it aren't
 * kept. Deleting every digit ends the run, as if it had never started, and the next digit starts a new one.
 */
export class LiveRun implements RunSession {
  /** The touch log of the run being played, from its first digit. */
  private readonly log = signal<TouchLog | undefined>(undefined);
  private readonly replayed = computed(() => {
    const log = this.log();
    return log === undefined ? undefined : replay(log);
  });
  readonly run = computed(() => {
    const run = this.replayed()?.run;
    return run?.digits === '' ? undefined : run;
  });
  /** When the current run's first digit was typed, on the precise clock. */
  private start = 0;

  /**
   * @param now A precise time in milliseconds, for the time between digits.
   * @param begin A new touch log, with no touches, for a run starting now.
   */
  constructor(
    private readonly now: () => number,
    private readonly begin: () => TouchLog,
  ) {}

  record(touch: KeypadTouch): void {
    this.add(touch);
  }

  /**
   * Records a touch, giving the touch log it went into, if any, to be kept: one whose run has no digits left is to be
   * forgotten.
   */
  add(touch: KeypadTouch): TouchLog | undefined {
    const now = this.now();
    let log = this.log();
    if (log === undefined) {
      if (touch.key === null || touch.key === 'backspace') {
        return undefined;
      }
      log = this.begin();
      this.start = now;
    }
    log = addTouch(log, touch, now - this.start);
    this.log.set(log);
    if (touch.key === 'backspace' && this.run() === undefined) {
      this.log.set(undefined);
    }
    return log;
  }

  waited(): number {
    const replayed = this.replayed();
    return this.now() - this.start - (replayed?.rewound ?? 0) - (replayed?.run.times.at(-1) ?? 0);
  }

  end(): void {
    this.log.set(undefined);
  }
}
