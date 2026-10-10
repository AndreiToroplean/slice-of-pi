import { Digit } from '../digit';

/**
 * The format of run records. Stored runs and backup files carry it, so code that finds a record in a format it doesn't
 * know (written by a newer version of the game, or a pull request preview sharing the site's storage) leaves it alone
 * rather than misreading it. Bump it whenever the shape of a run changes, and keep reading the older formats.
 */
export const RUN_FORMAT = 1;

/**
 * The raw record of one run: each digit typed and when. Nothing derived (groups, pauses, pace) is stored; it's always
 * computed from these (`groupings.md` §4).
 *
 * Backspace leaves no trace: it deletes the last digit's record and takes the clock back to when the digit before it
 * was typed, so the next digit's interval runs from the backspace. A run reads as if the player had typed it without
 * the mistake.
 */
export interface Run {
  readonly format: typeof RUN_FORMAT;
  readonly id: string;
  /** When the run started, in milliseconds since the Unix epoch. */
  readonly startedAt: number;
  /** The digits typed, in order. */
  readonly digits: string;
  /**
   * When each digit was typed, in whole milliseconds since the first digit, never decreasing; one per digit. Time
   * spent on deleted digits is left out.
   */
  readonly times: readonly number[];
}

/** A run that has no digits yet. */
export function newRun(id: string, startedAt: number): Run {
  return { format: RUN_FORMAT, id, startedAt, digits: '', times: [] };
}

/** The run with one more digit, typed `time` milliseconds after its first digit. */
export function addDigit(run: Run, digit: Digit, time: number): Run {
  return { ...run, digits: run.digits + digit, times: [...run.times, Math.round(time)] };
}

/** The run without its last digit, as if it had never been typed. */
export function removeDigit(run: Run): Run {
  return { ...run, digits: run.digits.slice(0, -1), times: run.times.slice(0, -1) };
}

/** Reads a run from untrusted data (storage, a backup file): the run if it's a valid run in a known format. */
export function parseRun(value: unknown): Run | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { format, id, startedAt, digits, times } = value as Partial<Record<keyof Run, unknown>>;
  if (
    format !== RUN_FORMAT ||
    typeof id !== 'string' ||
    id === '' ||
    !isTime(startedAt) ||
    typeof digits !== 'string' ||
    !/^[0-9]*$/.test(digits) ||
    !Array.isArray(times) ||
    times.length !== digits.length ||
    !times.every((time, i) => isTime(time) && time >= (times[i - 1] ?? 0))
  ) {
    return undefined;
  }
  return { format, id, startedAt, digits, times };
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
