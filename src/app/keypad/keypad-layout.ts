import { Digit } from '../digit';

/** What a key on the keypad does: type a digit or delete the last one. */
export type KeypadKey = Digit | 'backspace';

/** Where a key sits on the keypad grid; row 0 is the top row, column 0 the left column. */
export interface KeyPosition {
  readonly key: KeypadKey;
  readonly row: number;
  readonly column: number;
}

/**
 * Calculator-style layout, with 0 in the middle of the bottom row and backspace (⌫) next to it:
 *
 *     7 8 9
 *     4 5 6
 *     1 2 3
 *       0 ⌫
 *
 * Key positions are what keypad gesture patterns will be drawn from, so this layout is part of the game, not just
 * styling.
 */
export const KEYPAD_LAYOUT: readonly KeyPosition[] = [
  { key: '7', row: 0, column: 0 },
  { key: '8', row: 0, column: 1 },
  { key: '9', row: 0, column: 2 },
  { key: '4', row: 1, column: 0 },
  { key: '5', row: 1, column: 1 },
  { key: '6', row: 1, column: 2 },
  { key: '1', row: 2, column: 0 },
  { key: '2', row: 2, column: 1 },
  { key: '3', row: 2, column: 2 },
  { key: '0', row: 3, column: 1 },
  { key: 'backspace', row: 3, column: 2 },
];

const ROWS = Math.max(...KEYPAD_LAYOUT.map((position) => position.row)) + 1;
const COLUMNS = Math.max(...KEYPAD_LAYOUT.map((position) => position.column)) + 1;

/**
 * The key under a point `(x, y)` of a keypad occupying `rect`, or null if there is none (outside the keypad, or an empty
 * cell). The keypad is split into equal rectangular cells, so the gaps between keys, their rounded corners and the
 * keypad's padding all count as part of the nearest key.
 */
export function keyAt(
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  x: number,
  y: number,
): KeypadKey | null {
  const column = Math.floor(((x - rect.left) / rect.width) * COLUMNS);
  const row = Math.floor(((y - rect.top) / rect.height) * ROWS);
  return (
    KEYPAD_LAYOUT.find((position) => position.row === row && position.column === column)?.key ??
    null
  );
}
