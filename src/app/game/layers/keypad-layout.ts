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

type Rect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

/** The gaps between the keys of a keypad, between its columns and between its rows. */
export interface KeypadGaps {
  readonly column: number;
  readonly row: number;
}

/**
 * The key under a point `(x, y)` of a keypad in a layout whose keys occupy `keys`, `gaps` apart, and whose touches
 * `area`, around them: null if there is none (outside the area, or in an empty cell). Each key's cell reaches halfway
 * to the next key, so the gaps between keys and their rounded corners count as part of the nearest key, and the keys on
 * the edges reach out over the rest of the area, as far as it goes: those at its sides to its sides, those on top up to
 * its top, and those at the bottom down to its bottom.
 */
export function keyAt(
  layout: KeypadLayout,
  keys: Rect,
  gaps: KeypadGaps,
  area: Rect,
  x: number,
  y: number,
): KeypadKey | null {
  if (x < area.left || x >= area.left + area.width || y < area.top || y >= area.top + area.height) {
    return null;
  }
  // Equal cells, each a key and half a gap on either side of it.
  const column = cell(
    ((x - keys.left + gaps.column / 2) / (keys.width + gaps.column)) * COLUMNS,
    COLUMNS,
  );
  const row = cell(((y - keys.top + gaps.row / 2) / (keys.height + gaps.row)) * ROWS, ROWS);
  return (
    KEY_POSITIONS[layout].find((position) => position.row === row && position.column === column)
      ?.key ?? null
  );
}

/** The cell at a position counted in cells, those before the first and past the last counting as the nearest. */
function cell(position: number, count: number): number {
  return Math.min(Math.max(Math.floor(position), 0), count - 1);
}
