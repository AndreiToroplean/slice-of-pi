/** The hint, until the player's own groups are known: the size of the group the game expects (`groupings.md` §3). */
export const DEFAULT_HINT = 5;

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

/**
 * Splits the typed decimals into groups. For now every group has `size` digits, so a group is finished as soon as its
 * last digit is typed; groups following the player's timings come later (`roadmap.md`, step 7).
 */
export function groupDigits(digits: string, size = DEFAULT_HINT): Grouping {
  const finished = digits.length - (digits.length % size);
  const words = Array.from({ length: finished / size }, (_, i) => ({
    firstPlace: i * size + 1,
    digits: digits.slice(i * size, (i + 1) * size),
  }));
  return { words, current: digits.slice(finished) };
}
