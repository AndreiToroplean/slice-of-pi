import { Digit } from '../digit';

/**
 * The format of run records. Stored runs and backup files carry it. Bump it whenever the shape of a run changes, and
 * migrate the older formats in {@link parseRun}, one step per version (`architecture.md` §5). Code that finds a record
 * in a newer format than it knows (written by a pull request preview sharing the site's storage) leaves it alone
 * rather than misreading it.
 */
export const RUN_FORMAT = 1;

/**
 * The raw record of one run: each digit typed and when. Nothing derived (groups, pauses, pace) is stored; it's always
 * computed from these (`groupings.md` §4).
 *
 * Backspace leaves no trace in the timings: it deletes the last digit's record and takes the clock back to when the digit before it
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
  /**
   * Where the player pressed backspace, kept apart from the timings: the place of each digit deleted, in order (place 1
   * is the first decimal). A backspace isn't necessarily a mistake, only that the player thought it was one.
   */
  readonly backspaces: readonly number[];
}

/** A run that has no digits yet. */
export function newRun(id: string, startedAt: number): Run {
  return { format: RUN_FORMAT, id, startedAt, digits: '', times: [], backspaces: [] };
}

/** The run with one more digit, typed `time` milliseconds after its first digit. */
export function addDigit(run: Run, digit: Digit, time: number): Run {
  return { ...run, digits: run.digits + digit, times: [...run.times, Math.round(time)] };
}

/** The run without its last digit, as if it had never been typed, but with the backspace that deleted it. */
export function removeDigit(run: Run): Run {
  if (run.digits === '') {
    return run;
  }
  return {
    ...run,
    digits: run.digits.slice(0, -1),
    times: run.times.slice(0, -1),
    backspaces: [...run.backspaces, run.digits.length],
  };
}

/**
 * Reads a run from untrusted data (storage, a backup file): the run if it's a valid run in a known format. Format 1 is
 * the only one so far; migrations from older formats will go here.
 */
export function parseRun(value: unknown): Run | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { format, id, startedAt, digits, times, backspaces } = value as Partial<
    Record<keyof Run, unknown>
  >;
  if (
    format !== RUN_FORMAT ||
    typeof id !== 'string' ||
    id === '' ||
    !isTime(startedAt) ||
    typeof digits !== 'string' ||
    !/^[0-9]*$/.test(digits) ||
    !Array.isArray(times) ||
    times.length !== digits.length ||
    !times.every((time, i) => isTime(time) && time >= (times[i - 1] ?? 0)) ||
    !Array.isArray(backspaces) ||
    !backspaces.every((place) => Number.isInteger(place) && (place as number) >= 1)
  ) {
    return undefined;
  }
  return { format, id, startedAt, digits, times, backspaces: backspaces as number[] };
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
