import { BreakModel } from '../timing/break-model';

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
 * The size of the group starting at index `start` (index 0 is the first decimal): within the trust horizon, as many
 * digits as the player's group there has left, else the default (`groupings.md` §4.3).
 */
export function groupSizeAt(model: BreakModel, start: number): number {
  const group = model.groups.find((g) => start >= g.start && start < g.start + g.size);
  return group?.trusted === true ? group.start + group.size - start : DEFAULT_GROUP_SIZE;
}

/**
 * Whether the group being typed is finished: whether the player usually breaks before the next digit, at index
 * `next` (`groupings.md` §4.1). The model includes the run being typed, like any other run, its next digit timed as if
 * typed now.
 */
export function groupEnds(model: BreakModel, next: number): boolean {
  return (model.usual[next] ?? 0) > 0.5;
}
