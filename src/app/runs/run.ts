import { KeypadKey } from '../keypad/keypad-layout';

/**
 * The format of run records. Stored runs and backup files carry it, so code that finds a record in a format it doesn't
 * know (written by a newer version of the game, or a pull request preview sharing the site's storage) leaves it alone
 * rather than misreading it. Bump it whenever the shape of a run changes, and keep reading the older formats.
 */
export const RUN_FORMAT = 1;

/** How backspace is written among the keys of a run. Keep {@link parseRun}'s pattern in step with it. */
export const BACKSPACE = '<';

/**
 * The raw record of one run: every key the player pressed and when. Nothing derived (groups, pauses, pace) is stored;
 * it's always computed from these (`groupings.md` §4).
 */
export interface Run {
  readonly format: typeof RUN_FORMAT;
  readonly id: string;
  /** When the run started, in milliseconds since the Unix epoch. */
  readonly startedAt: number;
  /** The keys pressed, in order: one character each, a digit or {@link BACKSPACE}. */
  readonly keys: string;
  /** When each key was pressed, in whole milliseconds since the first key, never decreasing; one per key. */
  readonly times: readonly number[];
}

/** The digits a run ended with, after its backspaces, and when each of them was typed. */
export interface TypedRun {
  readonly digits: string;
  /** When each digit was typed, in milliseconds since the first key; one per digit. */
  readonly times: readonly number[];
}

/** A run that has no keys yet. */
export function newRun(id: string, startedAt: number): Run {
  return { format: RUN_FORMAT, id, startedAt, keys: '', times: [] };
}

/** The run with one more key, pressed `time` milliseconds after its first key. */
export function addKey(run: Run, key: KeypadKey, time: number): Run {
  return {
    ...run,
    keys: run.keys + (key === 'backspace' ? BACKSPACE : key),
    times: [...run.times, Math.round(time)],
  };
}

/** Replays the keys of a run: the digits left standing, each with the time it was typed. */
export function typedRun(run: Run): TypedRun {
  let digits = '';
  const times: number[] = [];
  for (let i = 0; i < run.keys.length; i++) {
    const key = run.keys.charAt(i);
    if (key === BACKSPACE) {
      digits = digits.slice(0, -1);
      times.pop();
    } else {
      digits += key;
      times.push(run.times[i] ?? 0);
    }
  }
  return { digits, times };
}

/** Reads a run from untrusted data (storage, a backup file): the run if it's a valid run in a known format. */
export function parseRun(value: unknown): Run | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { format, id, startedAt, keys, times } = value as Partial<Record<keyof Run, unknown>>;
  if (
    format !== RUN_FORMAT ||
    typeof id !== 'string' ||
    id === '' ||
    !isTime(startedAt) ||
    typeof keys !== 'string' ||
    !/^[0-9<]*$/.test(keys) ||
    !Array.isArray(times) ||
    times.length !== keys.length ||
    !times.every((time, i) => isTime(time) && time >= (times[i - 1] ?? 0))
  ) {
    return undefined;
  }
  return { format, id, startedAt, keys, times };
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
