import { BreakModel, BreakSettings } from '../timing/break-model';

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

/** How the group starting at a place is played (`groupings.md` §3). */
export interface GroupPlan {
  /** How many slots it starts with. */
  readonly size: number;
  /**
   * Whether it's the player's own group, within the trust horizon, which finishes where the player usually breaks.
   * Past the horizon, a group finishes where this run breaks.
   */
  readonly trusted: boolean;
}

/**
 * How the group starting at index `start` (index 0 is the first decimal) is played: within the trust horizon, as the
 * player's own group there, as many slots as it has digits left; past it, groups of the starting slots (5 by default)
 * that grow until the player breaks (`groupings.md` §4.3). The horizon is the model's, unless another is given.
 */
export function groupAt(
  model: BreakModel,
  start: number,
  settings: BreakSettings,
  horizon = model.horizon,
): GroupPlan {
  const group = model.groups.find((g) => start >= g.start && start < g.start + g.size);
  return group !== undefined && !group.open && group.start + group.size <= horizon
    ? { size: group.start + group.size - start, trusted: true }
    : { size: settings.startingSlots, trusted: false };
}

/**
 * How many slots a group shows once `typed` digits are in it: a group gets a slot for each digit typed past its slots,
 * never one ahead of it, as it finishes only when the player breaks: the player shows where their group ends.
 */
export function slotCount(plan: GroupPlan, typed: number): number {
  return Math.max(plan.size, typed);
}

/**
 * Whether the group being typed is finished before the next digit, at index `next` (`groupings.md` §4.1). The model
 * includes the run being typed, like any other run, its next digit timed as if typed now. Within the trust horizon, the
 * group ends where the player usually breaks; past it, where this run breaks.
 */
export function groupEnds(
  model: BreakModel,
  next: number,
  trusted: boolean,
  settings: BreakSettings,
): boolean {
  return trusted
    ? (model.usual[next] ?? 0) > settings.usualThreshold
    : (model.runs.at(-1)?.breakProbability[next] ?? 0) > settings.breakThreshold;
}
