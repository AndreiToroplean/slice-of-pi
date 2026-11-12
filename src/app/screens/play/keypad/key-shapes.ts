import { Digit } from '../../../game/pi/digit';
import { Joint, Merges } from './key-merges';

/** A box, in CSS pixels. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A key's corners, top left, top right, bottom right, bottom left, as CSS lists them. */
export type Corners = readonly [number, number, number, number];

/**
 * A key's shape: two boxes, the key stretched sideways toward the keys it merges with there, and up and down toward
 * those it merges with there, both with its corners. Two boxes rather than one, so that a key merging on two sides
 * doesn't fill its corner between them: the corner inside three keys merged stays square.
 */
export interface KeyShape {
  readonly key: Digit;
  /** The key itself, unstretched. */
  readonly box: Box;
  readonly across: Box;
  readonly along: Box;
  readonly radii: Corners;
  /** Which of its sides touch the key there, merged all the way: left, top, right, bottom. */
  readonly joined: readonly [boolean, boolean, boolean, boolean];
  /**
   * The square between it, the key left of it and the two above, once all four touch, merged all the way: part of it,
   * the nearest of the four, drawn over the others.
   */
  readonly corner: Box | undefined;
}

/** A key on the keypad's grid, its box where it is at rest. */
export interface KeyAt {
  readonly key: Digit;
  readonly row: number;
  readonly column: number;
  readonly box: Box;
}

/**
 * How far past touching two keys merged all the way reach into each other, in CSS pixels, so that no seam shows where
 * they meet.
 */
const OVERLAP = 1;

/** Eases a merge's progress in and out. */
function eased(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return p * p * (3 - 2 * p);
}

/**
 * The keys' shapes, merging: two keys next to each other reach for each other, each half way across the gap between
 * them, their corners facing each other squaring as they do, until their sides touch, straight, as one key. A key
 * pressed sinks as it is, merged or not.
 */
export function keyShapes(
  keys: readonly KeyAt[],
  joints: readonly Joint[],
  merges: Merges,
  radius: number,
  gapX: number,
  gapY: number,
): readonly KeyShape[] {
  const progressOf = (joint: Joint): number => merges.get(joint.id) ?? 0;
  // How far each key has merged with the key on each of its sides: left, top, right, bottom.
  const sides = new Map(keys.map((key) => [key.key, [0, 0, 0, 0]]));
  for (const joint of joints) {
    const progress = progressOf(joint);
    const [onFirst, onSecond] = joint.axis === 'row' ? [2, 0] : [3, 1];
    const first = sides.get(joint.first);
    const second = sides.get(joint.second);
    if (first !== undefined && second !== undefined) {
      first[onFirst] = progress;
      second[onSecond] = progress;
    }
  }
  // The squares between four keys merged all the way, by the key nearest of the four, bottom right.
  const corners = new Map<Digit, Box>();
  const keyAt = (row: number, column: number): KeyAt | undefined =>
    keys.find((key) => key.row === row && key.column === column);
  const merged = (a: KeyAt, b: KeyAt): boolean =>
    joints.some(
      (joint) =>
        ((joint.first === a.key && joint.second === b.key) ||
          (joint.first === b.key && joint.second === a.key)) &&
        progressOf(joint) >= 1,
    );
  for (const topLeft of keys) {
    const topRight = keyAt(topLeft.row, topLeft.column + 1);
    const bottomLeft = keyAt(topLeft.row + 1, topLeft.column);
    const bottomRight = keyAt(topLeft.row + 1, topLeft.column + 1);
    if (
      topRight !== undefined &&
      bottomLeft !== undefined &&
      bottomRight !== undefined &&
      merged(topLeft, topRight) &&
      merged(bottomLeft, bottomRight) &&
      merged(topLeft, bottomLeft) &&
      merged(topRight, bottomRight)
    ) {
      const x = topLeft.box.x + topLeft.box.width;
      const y = topLeft.box.y + topLeft.box.height;
      corners.set(bottomRight.key, {
        x: x - OVERLAP,
        y: y - OVERLAP,
        width: topRight.box.x - x + 2 * OVERLAP,
        height: bottomLeft.box.y - y + 2 * OVERLAP,
      });
    }
  }
  return keys.map(({ key, box }): KeyShape => {
    const [left = 0, top = 0, right = 0, bottom = 0] = sides.get(key) ?? [];
    const reach = (progress: number, gap: number): number =>
      (eased(progress) * gap) / 2 + (progress >= 1 ? OVERLAP : 0);
    const l = reach(left, gapX);
    const t = reach(top, gapY);
    const r = reach(right, gapX);
    const b = reach(bottom, gapY);
    const round = (one: number, other: number): number =>
      radius * (1 - eased(Math.max(one, other)));
    return {
      key,
      box,
      joined: [left >= 1, top >= 1, right >= 1, bottom >= 1],
      across: { x: box.x - l, y: box.y, width: box.width + l + r, height: box.height },
      along: { x: box.x, y: box.y - t, width: box.width, height: box.height + t + b },
      radii: [round(left, top), round(top, right), round(right, bottom), round(bottom, left)],
      corner: corners.get(key),
    };
  });
}
