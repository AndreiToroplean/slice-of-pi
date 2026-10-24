import { KeypadLayout } from '../game/layers/keypad-layout';
import { isPiDecimal } from '../game/pi/pi';
import { TouchLog } from './touch-log';

/** What a run holds (see {@link Run}). */
interface RunFields {
  readonly id: string;
  /**
   * Whether the game checked each digit as it was typed, so the run only holds decimals of π. Runs played without
   * checking, in developer mode, aren't, nor are those from before the game checked digits: they may hold mistakes.
   */
  readonly checked: boolean;
  /** The keypad layout the run was played on: where each key was. */
  readonly keypadLayout: KeypadLayout;
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

declare const runBrand: unique symbol;

/**
 * A run: each digit typed and when, as the game plays the groups from it. Nothing derived from it (groups, pauses, pace)
 * is kept; it's always computed from these. A run is itself derived from its touch log, the record kept of it, only by
 * {@link replay}.
 */
export type Run = RunFields & { readonly [runBrand]: true };

/**
 * The run a touch log records, and how far back backspaces have taken its clock, in milliseconds: how much time spent
 * on deleted digits is left out since its first digit.
 *
 * Touches typing nothing are left out. Backspace deletes the last digit: its time is left out, and the clock goes back to
 * when the digit before it was typed, so the next digit's interval runs from the backspace. A run reads as if the player
 * had typed it without the deleted digits. In a checked run, a wrong digit, and any typed after it until backspace
 * deletes them all, are mistakes: never kept, they leave no timings, but backspace takes the clock back to the last
 * digit kept all the same.
 */
export function replay(log: TouchLog): { readonly run: Run; readonly rewound: number } {
  const digits: string[] = [];
  const times: number[] = [];
  let mistakes = 0;
  let rewound = 0;
  for (const { key, time } of log.touches) {
    if (key === null) {
      continue;
    }
    if (key === 'backspace') {
      if (mistakes > 0) {
        mistakes--;
      } else if (digits.length > 0) {
        digits.pop();
        times.pop();
      } else {
        continue;
      }
      rewound = time - (times.at(-1) ?? 0);
    } else if (log.checked && (mistakes > 0 || !isPiDecimal(digits.length + 1, key))) {
      mistakes++;
    } else {
      digits.push(key);
      times.push(time - rewound);
    }
  }
  const run: RunFields = {
    id: log.id,
    checked: log.checked,
    keypadLayout: log.keypadLayout,
    startedAt: log.startedAt,
    digits: digits.join(''),
    times,
  };
  return { run: run as Run, rewound };
}

/** The run a touch log records (see {@link replay}). */
export function runOf(log: TouchLog): Run {
  return replay(log).run;
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
