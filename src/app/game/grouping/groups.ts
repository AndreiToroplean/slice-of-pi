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

/** How the group starting at a place is played. */
export interface GroupPlan {
  /** How many slots it starts with. */
  readonly size: number;
  /**
   * Whether it's the player's own group, as far as the break model trusts it, which finishes where the player usually
   * breaks. Otherwise, a group finishes where this run breaks.
   */
  readonly trusted: boolean;
}

/**
 * How many slots a group shows once `typed` digits are in it: a group gets a slot for each digit typed past its slots,
 * never one ahead of it, as it finishes only when the player breaks: the player shows where their group ends.
 */
export function slotCount(plan: GroupPlan, typed: number): number {
  return Math.max(plan.size, typed);
}
