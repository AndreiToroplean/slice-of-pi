import { isDigit } from '../../game/pi/digit';
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
  return { id: log.id, startedAt: log.startedAt, perfect, splits };
}

/** The records of the runs that count on the leaderboards (see {@link recordOf}). */
export function recordsOf(logs: readonly TouchLog[]): RunRecord[] {
  return logs.flatMap((log) => recordOf(log) ?? []);
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

/** The first split place past a value: the next one to reach. */
export function nextSplitPlace(value: number): number {
  let index = 0;
  while (splitPlace(index) <= value) {
    index++;
  }
  return splitPlace(index);
}
