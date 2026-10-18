import { Digit } from '../pi/digit';

/** What a key on the keypad does: type a digit or delete the last one. */
export type KeypadKey = Digit | 'backspace';

/** Where a key sits on the keypad grid; row 0 is the top row, column 0 the left column. */
export interface KeyPosition {
  readonly key: KeypadKey;
  readonly row: number;
  readonly column: number;
}

/** The layouts the keypad comes in, which the player picks from. */
export const KEYPAD_LAYOUTS = ['calculator', 'telephone'] as const;
export type KeypadLayout = (typeof KEYPAD_LAYOUTS)[number];
/** The layout the keypad has unless the player picks another. */
export const DEFAULT_KEYPAD_LAYOUT: KeypadLayout = 'calculator';

/** 0 in the middle of the bottom row, and backspace (⌫) next to it, in every layout. */
const BOTTOM_ROW: readonly KeyPosition[] = [
  { key: '0', row: 3, column: 1 },
  { key: 'backspace', row: 3, column: 2 },
];

/** The digits 1 to 9 in rows of three, in the order of `rows`, the top row first. */
function digitRows(rows: readonly (readonly Digit[])[]): KeyPosition[] {
  return rows.flatMap((keys, row) => keys.map((key, column) => ({ key, row, column })));
}

/**
 * Where each key sits in each layout: calculator-style, with 7 8 9 on top, or telephone-style, with 1 2 3 on top, and
 * the same bottom row:
 *
 *     7 8 9      1 2 3
 *     4 5 6      4 5 6
 *     1 2 3      7 8 9
 *       0 ⌫        0 ⌫
 *
 * Key positions are what keypad gesture patterns will be drawn from, so the layouts are part of the game, not just
 * styling, and each run records the one it was played on.
 */
export const KEY_POSITIONS: Readonly<Record<KeypadLayout, readonly KeyPosition[]>> = {
  calculator: [
    ...digitRows([
      ['7', '8', '9'],
      ['4', '5', '6'],
      ['1', '2', '3'],
    ]),
    ...BOTTOM_ROW,
  ],
  telephone: [
    ...digitRows([
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
    ]),
    ...BOTTOM_ROW,
  ],
};

/** The keypad's grid, the same in every layout. */
const ROWS = 4;
const COLUMNS = 3;

/**
 * The key under a point `(x, y)` of a keypad in a layout occupying `rect`, or null if there is none (outside the keypad, or an empty
 * cell). The keypad is split into equal rectangular cells, so the gaps between keys, their rounded corners and the
 * keypad's padding all count as part of the nearest key.
 */
export function keyAt(
  layout: KeypadLayout,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  x: number,
  y: number,
): KeypadKey | null {
  const column = Math.floor(((x - rect.left) / rect.width) * COLUMNS);
  const row = Math.floor(((y - rect.top) / rect.height) * ROWS);
  return (
    KEY_POSITIONS[layout].find((position) => position.row === row && position.column === column)
      ?.key ?? null
  );
}
