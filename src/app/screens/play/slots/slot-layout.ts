/** The most slots in one row, which spans the slots' width; past that, slots go on a new row below. */
export const SLOTS_PER_ROW = 10;

export interface SlotLayout {
  /** How many slots to show. */
  readonly count: number;
  /** How many slots per row. */
  readonly columns: number;
}

/**
 * Lays out the slots of the group being typed: one per digit of its size, plus one per mistake typed past it.
 * Rows grow to 10 slots, then a new row starts.
 */
export function slotLayout(typed: number, size: number): SlotLayout {
  const count = Math.max(size, typed);
  return {
    count,
    columns: Math.min(count, SLOTS_PER_ROW),
  };
}
