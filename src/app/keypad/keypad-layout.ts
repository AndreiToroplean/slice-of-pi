import { Digit } from '../digit';

/** Where a key sits on the keypad grid; row 0 is the top row, column 0 the left column. */
export interface KeyPosition {
  readonly digit: Digit;
  readonly row: number;
  readonly column: number;
}

/**
 * Calculator-style layout, with 0 alone in the middle of the bottom row:
 *
 *     7 8 9
 *     4 5 6
 *     1 2 3
 *       0
 *
 * Key positions are what keypad gesture patterns will be drawn from, so this layout is part of the game, not just
 * styling.
 */
export const KEYPAD_LAYOUT: readonly KeyPosition[] = [
  { digit: '7', row: 0, column: 0 },
  { digit: '8', row: 0, column: 1 },
  { digit: '9', row: 0, column: 2 },
  { digit: '4', row: 1, column: 0 },
  { digit: '5', row: 1, column: 1 },
  { digit: '6', row: 1, column: 2 },
  { digit: '1', row: 2, column: 0 },
  { digit: '2', row: 2, column: 1 },
  { digit: '3', row: 2, column: 2 },
  { digit: '0', row: 3, column: 1 },
];
