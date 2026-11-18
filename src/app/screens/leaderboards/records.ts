import { Digit, isDigit } from '../../game/pi/digit';
import { isPiDecimal } from '../../game/pi/pi';
import { startOf, TouchLog } from '../../player-data/touch-log';

/** How many records each leaderboard shows: the podium's. */
export const PODIUM = 3;

/** What a run counts for on the leaderboards, worked out from its touch log. */
export interface RunRecord {
  readonly id: string;
  /** When it started, in milliseconds since the Unix epoch. */
  readonly startedAt: number;
  /**
   * The place its perfect run reached: how many digits it typed right from the start of π before its first mistake,
   * or its first backspace, which only a mistake is worth.
   */
  readonly perfect: number;
  /**
   * Its split times: how long its perfect run took to reach each split place it reached (see {@link splitPlace}), in
   * order, in milliseconds from its first digit.
   */
  readonly splits: readonly number[];
  /** Its mastery, mistakes counted (see {@link masteryOf}), and how far it got, and with how many mistakes. */
  readonly mastery: Mastery;
}

/** A run's mastery, how far it got, and with how many mistakes. */
export interface Mastery {
  /** How many digits of π it proves the player knows. */
  readonly value: number;
  /** The farthest place it reached, typing right. */
  readonly reached: number;
  readonly mistakes: number;
  /**
   * The wrong digits tried at the place it got to, never typed right: where it stopped, or, as it's played, those at
   * the place being typed, which count as mistakes once typed right.
   */
  readonly stoppedOn: number;
}

/** One record on a leaderboard: the run that set it, when, and its value. */
export interface LeaderboardEntry {
  readonly id: string;
  readonly startedAt: number;
  readonly value: number;
}

/**
 * What a run counts for on the leaderboards, if it counts at all: only the runs played from the start of π, with every
 * touch kept and every digit checked, do. Runs from a checkpoint skip the places before it, and Discovery's keep only
 * their latest typing of each place.
 */
export function recordOf(log: TouchLog): RunRecord | undefined {
  if (!log.checked || log.recording !== undefined || startOf(log) !== 0) {
    return undefined;
  }
  let perfect = 0;
  const splits: number[] = [];
  for (const { key, time } of log.touches) {
    if (key === null) {
      continue;
    }
    if (!isDigit(key) || !isPiDecimal(perfect, key)) {
      break;
    }
    perfect++;
    if (perfect === splitPlace(splits.length)) {
      splits.push(time);
    }
  }
  return { id: log.id, startedAt: log.startedAt, perfect, splits, mastery: masteryOf(log) };
}

/** A digit tried at a place of a run, as the game checks it: right or wrong, and when, from the run's first digit. */
interface Try {
  readonly place: number;
  readonly key: Digit;
  readonly right: boolean;
  readonly time: number;
}

/**
 * The digits a run tried, place after place from the one it starts from, as the game checks them: backspace takes the
 * player back a place, and any digit typed after a wrong one is no try, until backspace deletes them.
 */
function* triesOf(log: TouchLog): Generator<Try> {
  const start = startOf(log);
  let place = start;
  let pending = 0;
  for (const { key, time } of log.touches) {
    if (key === null) {
      continue;
    }
    if (key === 'backspace') {
      if (pending > 0) {
        pending--;
      } else if (place > start) {
        place--;
      }
      continue;
    }
    if (pending > 0) {
      pending++;
      continue;
    }
    const right = isPiDecimal(place, key);
    yield { place, key, right, time };
    if (right) {
      place++;
    } else {
      pending = 1;
    }
  }
}

/**
 * A run's mastery: how many digits of π it proves the player knows, mistakes counted, that is, how much likelier their
 * typing is if they know π than if they guessed, in decimal digits. Each place counts the different digits tried there,
 * however many times backspace takes the player back to it, the right one included: one typed right as the t-th proves
 * 1 − log₁₀ t, 1 on the first try, nothing on the tenth, which guessing would get to anyway. Typing a digit again counts
 * nothing more, right or wrong. Its mistakes are the wrong digits tried at the places it then typed right: those it
 * ends on, never typed right, are where it stopped, not mistakes. As the game checks each digit, any typed after a wrong
 * one are neither tries nor mistakes, until backspace deletes them.
 */
export function masteryOf(log: TouchLog): Mastery {
  let value = 0;
  let reached = startOf(log);
  const tried = new Map<number, Set<Digit>>();
  for (const { place, key, right } of triesOf(log)) {
    const triedHere = tried.get(place) ?? new Set();
    tried.set(place, triedHere);
    if (right && !triedHere.has(key)) {
      value += 1 - Math.log10(triedHere.size + 1);
    }
    triedHere.add(key);
    if (right) {
      reached = Math.max(reached, place + 1);
    }
  }
  // The places typed right, before the farthest it got, each hold their right digit and their mistakes.
  let mistakes = 0;
  for (const [place, here] of tried) {
    if (place < reached) {
      mistakes += here.size - 1;
    }
  }
  return { value, reached, mistakes, stoppedOn: tried.get(reached)?.size ?? 0 };
}

/** A split place a run reached, and when it first got there, in milliseconds from its first digit, if it has yet. */
export interface ReachedSplit {
  readonly place: number;
  readonly time: number | undefined;
}

/**
 * The last split place a run reached, typing right, mistakes or not, and when it first got there: `from`, the place it
 * counts from, as the checkpoint a game started from, or any split place past it. A run can start before `from`, from
 * the start of its group: `from` then has no time until reached. Mistakes don't matter: a leaderboard counting from a
 * later place may still rank the splits after them.
 */
export function lastSplitOf(log: TouchLog, from = startOf(log)): ReachedSplit {
  let reached = startOf(log);
  let last: ReachedSplit = { place: from, time: reached === from ? 0 : undefined };
  for (const { place, right, time } of triesOf(log)) {
    if (right && place === reached) {
      reached++;
      if (reached === from || (reached > from && isSplitPlace(reached))) {
        last = { place: reached, time };
      }
    }
  }
  return last;
}

/**
 * A mastery as the leaderboards rank it: to a tenth, never rounded up, so that a run never shows more than it proved,
 * past the error the sums of logarithms leave.
 */
export function masteryTenths(value: number): number {
  return Math.floor(value * 10 + 1e-9) / 10;
}

/** The records of the runs that count on the leaderboards (see {@link recordOf}). */
export function recordsOf(logs: readonly TouchLog[]): RunRecord[] {
  return logs.flatMap((log) => recordOf(log) ?? []);
}

/** The farthest place a perfect run reached, the player's record: 0 before any. */
export function bestPerfectRun(logs: readonly TouchLog[]): number {
  return Math.max(0, ...recordsOf(logs).map((record) => record.perfect));
}

/**
 * The best records at a feat, the best first, as many as on a podium: the highest values, or the lowest when `lowest`,
 * the earlier run first between equal ones, as it got there first. Runs with no value at it, `undefined`, are left out.
 */
export function podium(
  records: readonly RunRecord[],
  valueOf: (record: RunRecord) => number | undefined,
  { lowest = false } = {},
): LeaderboardEntry[] {
  return records
    .flatMap((record) => {
      const value = valueOf(record);
      return value === undefined ? [] : [{ id: record.id, startedAt: record.startedAt, value }];
    })
    .sort((a, b) => (lowest ? a.value - b.value : b.value - a.value) || a.startedAt - b.startedAt)
    .slice(0, PODIUM);
}

/** The places the leaderboards rank the time to reach, as splits: 25, 50, 100, then every hundred. */
export function splitPlace(index: number): number {
  return index < 2 ? 25 * (index + 1) : 100 * (index - 1);
}

/** Whether a place is a split place (see {@link splitPlace}). */
export function isSplitPlace(place: number): boolean {
  return place > 0 && nextSplitPlace(place - 1) === place;
}

/** The first split place past a value: the next one to reach. */
export function nextSplitPlace(value: number): number {
  let index = 0;
  while (splitPlace(index) <= value) {
    index++;
  }
  return splitPlace(index);
}
