import { Digit } from '../game/pi/digit';
import { migrate, Migration } from './migration';

/**
 * The format of run records. Stored runs and backup files carry it. Bump it whenever the shape of a run changes, with a
 * step in {@link RUN_MIGRATIONS} (see {@link migrate}). Code that finds a record
 * in a newer format than it knows (written by a pull request preview sharing the site's storage) leaves it alone
 * rather than misreading it.
 */
export const RUN_FORMAT = 2;

/**
 * The raw record of one run: each digit typed and when. Nothing derived (groups, pauses, pace) is stored; it's always
 * computed from these.
 *
 * Backspace leaves no trace in the timings: it deletes the last digit's record and takes the clock back to when the digit before it
 * was typed, so the next digit's interval runs from the backspace. A run reads as if the player had typed it without
 * the mistake.
 */
export interface Run {
  readonly format: typeof RUN_FORMAT;
  readonly id: string;
  /**
   * Whether the game checked each digit as it was typed, so the run only holds decimals of π. Runs played without
   * checking, in developer mode, aren't, nor are those from before the game checked digits: they may hold mistakes.
   */
  readonly checked: boolean;
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

/** A run that has no digits yet, checked unless said otherwise. */
export function newRun(id: string, startedAt: number, checked = true): Run {
  return { format: RUN_FORMAT, id, checked, startedAt, digits: '', times: [], backspaces: [] };
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
 * Whether the player's groups are computed from this run: a checked one does, an unchecked one, which may hold
 * mistakes, only when unchecked runs are included.
 */
export function countsInGroups(run: Run, includeUnchecked: boolean): boolean {
  return run.checked || includeUnchecked;
}

/**
 * The order the game takes the player's runs in, in developer mode, rather than the order they were played in, and
 * where the line it plays from is among them, if anywhere: as if only the runs above the line had been played.
 */
export interface RunOrder {
  /** The ids of the runs, in that order. */
  readonly ids: readonly string[];
  /** How many of them are above the line played from, if the game plays from one. */
  readonly line?: number;
}

/**
 * The player's runs in the order the game takes them, from oldest by start unless they were put in another order, and
 * how many of them are above the line played from, if the game plays from one. The runs left out of that order, played
 * since it was set, go just above the line, after the runs above it, so they count as the newest, or after all the
 * runs if there is no line.
 */
export function orderRuns(
  runs: readonly Run[],
  order: RunOrder | undefined,
): { readonly runs: readonly Run[]; readonly line: number | undefined } {
  if (order === undefined) {
    return { runs, line: undefined };
  }
  const byId = new Map(runs.map((run) => [run.id, run]));
  const runsOf = (ids: readonly string[]): Run[] =>
    ids.flatMap((id) => {
      const run = byId.get(id);
      return run === undefined ? [] : [run];
    });
  const above = runsOf(order.ids.slice(0, order.line));
  const below = runsOf(order.ids.slice(order.line ?? order.ids.length));
  const ordered = new Set(order.ids);
  const since = runs.filter((run) => !ordered.has(run.id));
  return {
    runs: [...above, ...since, ...below],
    line: order.line === undefined ? undefined : above.length + since.length,
  };
}

/**
 * The order of the runs once one is moved to another place among them, the line counting as a place: moving a run past
 * the line puts it on the other side of it. `from` and `to` are indexes among the runs and the line, `to` being where
 * the run ends up.
 */
export function moveRun(order: RunOrder, from: number, to: number): RunOrder {
  const places: (string | undefined)[] = [...order.ids];
  if (order.line !== undefined) {
    places.splice(order.line, 0, undefined);
  }
  places.splice(to, 0, ...places.splice(from, 1));
  const ids = places.filter((id) => id !== undefined);
  const line = places.indexOf(undefined);
  return line === -1 ? { ids } : { ids, line };
}

/**
 * The runs the player's groups are computed from, out of all their runs, oldest first: those above the line played
 * from, if any (see {@link orderRuns}), that count in them (see {@link countsInGroups}).
 */
export function groupRuns(
  runs: readonly Run[],
  includeUnchecked: boolean,
  order: RunOrder | undefined,
): Run[] {
  const ordered = orderRuns(runs, order);
  return ordered.runs.slice(0, ordered.line).filter((run) => countsInGroups(run, includeUnchecked));
}

/**
 * The run with the backspace that deleted a wrong digit typed after its last one, at `place` (the first wrong digit is
 * at the place after the run's last digit, and any typed after it further on). The game never kept those digits, so
 * only the backspace is recorded.
 */
export function deleteMistake(run: Run, place: number): Run {
  return { ...run, backspaces: [...run.backspaces, place] };
}

/**
 * Reads a run from untrusted data (storage, a backup file): the run if it's a valid run in a known format, migrated to
 * the current one.
 */
export function parseRun(value: unknown): Run | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { format, id, checked, startedAt, digits, times, backspaces } = migrate(
    value,
    RUN_MIGRATIONS,
  );
  if (
    format !== RUN_FORMAT ||
    typeof id !== 'string' ||
    id === '' ||
    typeof checked !== 'boolean' ||
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
  return { format, id, checked, startedAt, digits, times, backspaces: backspaces as number[] };
}

/** The steps that bring runs in older formats to the current one, one per format (see {@link migrate}). */
export const RUN_MIGRATIONS: readonly Migration[] = [
  // Format 1 runs are from before the game checked digits.
  (run) => ({ ...run, checked: false }),
];

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
