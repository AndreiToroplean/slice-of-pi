import { Digit } from '../digit';
import { KEYPAD_LAYOUT } from '../keypad/keypad-layout';
import { PI_DECIMALS } from '../pi/pi-decimals';

/**
 * How hard it is to reach a key from the one typed before it, by Fitts's law: `log2(1 + distance)`, the distance between
 * the two keys' centers counted in keys. Typing the same key again is 0, the next key 1, and the time it takes grows
 * by about the same factor for each step, whatever the groups (`break-model.ts`).
 */
export function reachDifficulty(from: Digit, to: Digit): number {
  const start = KEYPAD_LAYOUT.find((position) => position.key === from);
  const end = KEYPAD_LAYOUT.find((position) => position.key === to);
  if (start === undefined || end === undefined) {
    return 0;
  }
  return Math.log2(1 + Math.hypot(end.row - start.row, end.column - start.column));
}

/**
 * The reach difficulty of the first `count` intervals of π's decimals, the digits every run types: interval p is the
 * one before decimal index p + 1, as in a run.
 */
export function reaches(count: number): Float64Array {
  return Float64Array.from({ length: count }, (_, p) =>
    reachDifficulty(decimal(p), decimal(p + 1)),
  );
}

function decimal(index: number): Digit {
  return PI_DECIMALS.charAt(index) as Digit;
}

/** How many of π's decimals {@link TYPICAL_REACH} is taken over. */
const TYPICAL_DECIMALS = 1000;

/**
 * The mean reach difficulty of π's intervals and the mean of its square, over its first thousand decimals: what any
 * run of π's decimals typically has to reach, whichever places it covers.
 */
export const TYPICAL_REACH: { readonly mean: number; readonly square: number } = (() => {
  const all = reaches(TYPICAL_DECIMALS);
  return {
    mean: all.reduce((sum, value) => sum + value, 0) / all.length,
    square: all.reduce((sum, value) => sum + value * value, 0) / all.length,
  };
})();
