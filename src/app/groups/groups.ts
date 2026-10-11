import { Aggregate, aggregate, analyzeRun, RunPlace, TimingSettings } from '../timing/timing-model';

/** The size of a group where the player's own groups aren't trusted (`groupings.md` §3). */
export const DEFAULT_GROUP_SIZE = 5;

/** A group the player has finished typing, shown among the typed digits as a word. */
export interface Word {
  /** The place of its first digit: place 1 is the first decimal. */
  readonly firstPlace: number;
  readonly digits: string;
}

/** The typed decimals, split into the finished groups and the group being typed. */
export interface Grouping {
  readonly words: readonly Word[];
  /** The digits typed so far in the group being typed, possibly none. */
  readonly current: string;
}

/** Splits the typed decimals into the finished groups, of the given sizes in order, and the group being typed. */
export function groupDigits(digits: string, sizes: readonly number[]): Grouping {
  let start = 0;
  const words = sizes.map((size) => {
    const word = { firstPlace: start + 1, digits: digits.slice(start, start + size) };
    start += size;
    return word;
  });
  return { words, current: digits.slice(start) };
}

/**
 * The size of the group starting at index `start` (index 0 is the first decimal): where the aggregate's groups are
 * trusted, as many digits as its group there has left, else the default (`groupings.md` §4.3).
 */
export function groupSizeAt(model: Aggregate, start: number): number {
  const group = model.groups.find((g) => start >= g.start && start < g.start + g.size);
  return group !== undefined && start < model.trustedUntil
    ? group.start + group.size - start
    : DEFAULT_GROUP_SIZE;
}

/**
 * Whether the group being typed is finished: whether the aggregate of all the runs breaks before the next digit
 * (`groupings.md` §4.1). The run being typed is one of them, like any other, its next digit timed as if typed now,
 * `waited` milliseconds after its last one.
 *
 * The earlier runs are given oldest first, as returned by `analyzeRun`; `times` are the run being typed's, as recorded.
 */
export function groupEnds(
  earlier: readonly (readonly (RunPlace | undefined)[])[],
  times: readonly number[],
  waited: number,
  settings: TimingSettings,
): boolean {
  const last = times.at(-1);
  if (last === undefined) {
    return false;
  }
  const run = analyzeRun([...times, last + waited], settings);
  return aggregate([...earlier, run], settings).places[times.length]?.isBreak === true;
}
