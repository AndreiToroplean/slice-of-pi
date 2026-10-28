import type { Box } from '../flight/flight';

/** The most slots shown, which span the slots' width; past that, the first of them are off it, to the left. */
export const SLOTS_SHOWN = 10;

/**
 * How many slots the group being typed shows: one per digit of its size, up to {@link SLOTS_SHOWN}, plus one per digit
 * typed past them, as mistakes are.
 */
export function shownSlots(typed: number, size: number): number {
  return Math.max(Math.min(size, SLOTS_SHOWN), typed);
}

/**
 * Where the first of `count` slots in a row sits, in steps between slots from where the first of {@link SLOTS_SHOWN}
 * does: centered up to them, and past them ending where they do, the first of them off the slots' width, to the left.
 */
export function rowStart(count: number): number {
  return count <= SLOTS_SHOWN ? (SLOTS_SHOWN - count) / 2 : SLOTS_SHOWN - count;
}

/**
 * How far apart the slots are, in a row `width` wide of slots `slotWidth` wide: as `slots.css` spaces them, for
 * {@link SLOTS_SHOWN} of them to span it. Worked out here, as the gap computes to a formula rather than a length.
 */
export function slotGap(width: number, slotWidth: number): number {
  return Math.max(0, (width - SLOTS_SHOWN * slotWidth) / (SLOTS_SHOWN - 1));
}

/**
 * Where the first `count` slots sit when they're all the slots there are: in a row across `area`, as the slots do (see
 * {@link rowStart} and {@link slotGap}), each `slot` in size.
 */
export function slotBoxes(
  count: number,
  area: Box,
  slot: { readonly width: number; readonly height: number },
): Box[] {
  const gap = slotGap(area.width, slot.width);
  const free = area.width - count * slot.width - (count - 1) * gap;
  const left = area.left + (free > 0 ? free / 2 : free);
  return Array.from({ length: count }, (_, i) => ({
    left: left + i * (slot.width + gap),
    top: area.top + area.height - slot.height,
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
 * them left, each once the digit of the slot it was has left, by half the difference, as far as both show (see
 * {@link rowStart}). When there are more slots, those past the ones before are imagined on, past them, and fade in;
 * when there are fewer, the leftmost of the ones before go, fading out off-center (`leaving`), as do any off the slots'
 * width, as if there had been only those shown.
 */
export function slotHandover(
  before: number,
  after: number,
): { readonly slots: SlotMove[]; readonly leaving: SlotMove[] } {
  const gone = Math.max(0, before - after);
  const shift = rowStart(before) + gone - rowStart(after);
  return {
    slots: Array.from({ length: after }, (_, k) => ({
      from: k + shift,
      to: k,
      after: k + gone,
      ...(k >= before ? { fade: 'in' as const } : {}),
    })),
    leaving: Array.from({ length: gone }, (_, j) => ({
      from: j - gone + shift,
      to: j - gone,
      after: j,
      fade: 'out' as const,
    })),
  };
}
