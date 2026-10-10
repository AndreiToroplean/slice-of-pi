/** The most slots in one row; past that, slots go on a new row below. */
export const SLOTS_PER_ROW = 10;
/** Past this many slots, smaller slots are used, so that a row of 10 fits on a phone. */
export const MOST_LARGE_SLOTS = 6;

export interface SlotLayout {
  /** How many slots to show. */
  readonly count: number;
  /** How many slots per row. */
  readonly columns: number;
  /** Whether the slots are the smaller ones. */
  readonly dense: boolean;
}

/**
 * Lays out the slots of the group being typed: the hint, or one slot per digit once the player types past it
 * (`groupings.md` §3). Rows grow to 10 slots, then a new row starts.
 */
export function slotLayout(typed: number, hint: number): SlotLayout {
  const count = Math.max(hint, typed);
  return {
    count,
    columns: Math.min(count, SLOTS_PER_ROW),
    dense: count > MOST_LARGE_SLOTS,
  };
}
