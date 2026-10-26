import type { Box } from '../flight/flight';

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

/**
 * Where the first `count` slots sit when they're all the slots there are: rows of {@link SLOTS_PER_ROW} at most,
 * centered across `area` and standing on its bottom, as the slots do, each `slot` in size and `gap` apart.
 */
export function slotBoxes(
  count: number,
  area: Box,
  slot: { readonly width: number; readonly height: number },
  gap: { readonly column: number; readonly row: number },
): Box[] {
  const columns = Math.min(count, SLOTS_PER_ROW);
  const rows = Math.ceil(count / SLOTS_PER_ROW);
  const left = area.left + (area.width - columns * slot.width - (columns - 1) * gap.column) / 2;
  const top = area.top + area.height - rows * slot.height - (rows - 1) * gap.row;
  return Array.from({ length: count }, (_, i) => ({
    left: left + (i % SLOTS_PER_ROW) * (slot.width + gap.column),
    top: top + Math.floor(i / SLOTS_PER_ROW) * (slot.height + gap.row),
    width: slot.width,
    height: slot.height,
  }));
}

/**
 * A slot moving as the slots of a group that has ended hand over to those of the next one: from where it starts to
 * where it ends, in steps between slots from the first slot's place, once the digit of the slot it waits for has left.
 */
export interface SlotMove {
  readonly from: number;
  readonly to: number;
  /** The slot of the group that ended whose digit it waits for, or one imagined past them. */
  readonly after: number;
  /** Whether it fades in, coming, or out, going, as it moves. */
  readonly fade?: 'in' | 'out';
}

/**
 * How the slots move as a group that ended with `before` slots, all filled, hands over to one of `after` slots: all of
 * them left, by half the difference, each once the digit of the slot it was has left. When there are more slots, those
 * past the ones before are imagined on, past them, and fade in; when there are fewer, the leftmost of the ones before
 * go, fading out off-center (`leaving`).
 */
export function slotHandover(
  before: number,
  after: number,
): { readonly slots: SlotMove[]; readonly leaving: SlotMove[] } {
  const shift = Math.abs(before - after) / 2;
  const gone = Math.max(0, before - after);
  return {
    slots: Array.from({ length: after }, (_, k) => ({
      from: k + shift,
      to: k,
      after: k + gone,
      ...(k >= before ? { fade: 'in' as const } : {}),
    })),
    leaving: Array.from({ length: gone }, (_, j) => ({
      from: j - shift,
      to: j - 2 * shift,
      after: j,
      fade: 'out' as const,
    })),
  };
}
