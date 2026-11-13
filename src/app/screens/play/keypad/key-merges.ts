import { Digit, isDigit } from '../../../game/pi/digit';
import { KEY_POSITIONS, KeypadLayout } from '../../../game/layers/keypad-layout';
import { GAME_VALUES } from '../../../game-values';

/** How long the keypad's keys take to move, in milliseconds. */
export interface KeyMotion {
  /** How long two keys take to merge, or to split, all the way. */
  readonly merge: number;
  /** How long a key takes to sink all the way, pressed, or to rise back. */
  readonly press: number;
}

/** The game's own. */
export const KEY_MOTION: KeyMotion = GAME_VALUES.keyMotion;

/**
 * Two digit keys next to each other, which merge into one while they're the same color:
 * `first` left of `second`, sideways, or above it, up and down.
 */
export interface Joint {
  readonly id: string;
  readonly first: Digit;
  readonly second: Digit;
  readonly axis: 'row' | 'column';
}

/** How far each joint has merged, from 0, apart, to 1, one, by its id. */
export type Merges = ReadonlyMap<string, number>;

/** The joints between the digit keys of a layout, sideways then up and down. */
export function jointsOf(layout: KeypadLayout): readonly Joint[] {
  const positions = KEY_POSITIONS[layout];
  const at = (row: number, column: number): Digit | undefined => {
    const key = positions.find((p) => p.row === row && p.column === column)?.key;
    return key !== undefined && isDigit(key) ? key : undefined;
  };
  const joints: Joint[] = [];
  for (const axis of ['row', 'column'] as const) {
    for (const { key, row, column } of positions) {
      const next = axis === 'row' ? at(row, column + 1) : at(row + 1, column);
      if (isDigit(key) && next !== undefined) {
        joints.push({
          id: `${key}${axis === 'row' ? '-' : '|'}${next}`,
          first: key,
          second: next,
          axis,
        });
      }
    }
  }
  return joints;
}

/**
 * Moves each joint's merge on by `elapsed` ms, all the way taking `duration` ms, toward where it's headed: merged while
 * its keys are `merging`, apart otherwise. A joint not seen before starts where it's headed.
 */
export function stepMerges(
  merges: Merges,
  joints: readonly Joint[],
  merging: (joint: Joint) => boolean,
  elapsed: number,
  duration: number = KEY_MOTION.merge,
): Map<string, number> {
  const step = duration > 0 ? elapsed / duration : Infinity;
  return new Map(
    joints.map((joint) => {
      const target = merging(joint) ? 1 : 0;
      const progress = merges.get(joint.id) ?? target;
      return [
        joint.id,
        target > progress ? Math.min(target, progress + step) : Math.max(target, progress - step),
      ];
    }),
  );
}

/** Whether any merge is still under way. */
export function moving(
  merges: Merges,
  joints: readonly Joint[],
  merging: (joint: Joint) => boolean,
): boolean {
  return joints.some((joint) => (merges.get(joint.id) ?? 0) !== (merging(joint) ? 1 : 0));
}

/**
 * How far a key's lingering color has spread into the keys it touches, `elapsed` ms after it was let go: from 0, across
 * the gap between them only, to 1, from its far side to theirs, across both, as a drop of color spreads into the water it
 * touches, never evening out. It spreads from when they touch, a `merge` after it was let go, to the end of its
 * `linger`, straight away and slowing down (easing out).
 */
export function lingerSpread(elapsed: number, merge: number, linger: number): number {
  const span = linger - merge;
  const progress = span > 0 ? (elapsed - merge) / span : elapsed >= merge ? 1 : 0;
  return 1 - (1 - Math.min(1, Math.max(0, progress))) ** 3;
}
