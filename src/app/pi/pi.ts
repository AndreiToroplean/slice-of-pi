import { Digit } from '../digit';
import { PI_DECIMALS } from './pi-decimals';

/** How many decimals of π the game knows, and so can check. */
export const KNOWN_DECIMALS = PI_DECIMALS.length;

/**
 * Whether `digit` is the decimal of π at `place` (place 1 is the first decimal). Past the decimals the game knows, no
 * digit is: nobody gets that far, and a run never holds a digit the game couldn't check.
 */
export function isPiDecimal(place: number, digit: Digit): boolean {
  return PI_DECIMALS.charAt(place - 1) === digit;
}
