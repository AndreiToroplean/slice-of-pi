import { Digit } from '../digit';

/**
 * The format of run records. Stored runs and backup files carry it. Bump it whenever the shape of a run changes, and
 * migrate the older formats in {@link parseRun}, one step per version (`architecture.md` §5). Code that finds a record
 * in a newer format than it knows (written by a pull request preview sharing the site's storage) leaves it alone
 * rather than misreading it.
 */
export const RUN_FORMAT = 2;

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
 * Where the game plays from, in developer mode, as if only some of the player's runs had been played: those before a
 * line drawn among them, which the runs played since go on top of.
 */
export interface PlayFrom {
  /** How many runs, in the order the game took them then, were before the line when it was drawn. */
  readonly at: number;
  /** When it was drawn, in milliseconds since the Unix epoch: the runs started since are played from it. */
  readonly since: number;
  /** The line the game played from when this one was drawn, if any: the order the game took the runs in then. */
  readonly previous?: PlayFrom;
}

/**
 * The player's runs in the order the game takes them, from oldest by start, and how many of them come before the line
 * played from: all of them unless the game plays from one. Then the runs there were when the line was drawn keep the
 * order the game took them in then, so drawing a line never reorders them, and the runs played since go just before
 * the line, after the runs that were before it, so they count as the newest; the runs that were after it come after
 * them all, and don't count.
 */
export function playOrder(
  runs: readonly Run[],
  playFrom: PlayFrom | undefined,
): { readonly runs: readonly Run[]; readonly before: number } {
  if (playFrom === undefined) {
    return { runs, before: runs.length };
  }
  const earlier = playOrder(
    runs.filter((run) => run.startedAt < playFrom.since),
    playFrom.previous,
  ).runs;
  const since = runs.filter((run) => run.startedAt >= playFrom.since);
  const at = Math.min(playFrom.at, earlier.length);
  return {
    runs: [...earlier.slice(0, at), ...since, ...earlier.slice(at)],
    before: at + since.length,
  };
}

/**
 * The runs the player's groups are computed from, out of all their runs, oldest first: those before the line played
 * from, if any (see {@link playOrder}), that count in them (see {@link countsInGroups}).
 */
export function groupRuns(
  runs: readonly Run[],
  includeUnchecked: boolean,
  playFrom: PlayFrom | undefined,
): Run[] {
  const order = playOrder(runs, playFrom);
  return order.runs.slice(0, order.before).filter((run) => countsInGroups(run, includeUnchecked));
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
  const { format, id, checked, startedAt, digits, times, backspaces } = migrate(value);
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

/** Whether a stored record is in an older format than the current one, to be migrated. */
export function isOlderFormat(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'format' in value &&
    typeof value.format === 'number' &&
    value.format < RUN_FORMAT
  );
}

type RunRecord = Partial<Record<keyof Run, unknown>>;

/** A record in an older format brought to the current one, one step per format; any other record as it is. */
function migrate(record: RunRecord): RunRecord {
  let migrated = record;
  if (migrated.format === 1) {
    // Format 1 runs are from before the game checked digits.
    migrated = { ...migrated, format: 2, checked: false };
  }
  return migrated;
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
