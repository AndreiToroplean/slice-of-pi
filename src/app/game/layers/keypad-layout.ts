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
 * A point on the keypad, in steps from one key to the next, from the center of 5, the middle key in every layout: `x`
 * to the right, `y` down. The center of each key is at whole steps, such as 3's at (1, 1) on a calculator's keypad; a
 * point off the keys, in a gap or past the keys on the edges, is between them or beyond.
 */
export interface KeypadPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * A touch on the keypad (or a mouse press), where it started, typing a key or nothing (`null`) when it missed them;
 * or a key typed without touching the keypad, on a keyboard or by assistive technology, which was nowhere on it, but
 * stands at the center of its key (see {@link touchPoint}).
 */
export type KeypadTouch =
  (KeypadPoint & { readonly key: KeypadKey | null }) | { readonly key: KeypadKey };

/** Where a touch was on the keypad, in a layout: a key typed without touching it, at the center of its key. */
export function touchPoint(layout: KeypadLayout, touch: KeypadTouch): KeypadPoint {
  return 'x' in touch ? { x: touch.x, y: touch.y } : keyCenter(layout, touch.key);
}

/**
 * The point on the keypad of a point `(x, y)` on the screen, its keys occupying `keys`, `gaps` apart. Each key's cell
 * reaches halfway to the next keys: a step is a key and a gap.
 */
export function pointAt(keys: Rect, gaps: KeypadGaps, x: number, y: number): KeypadPoint {
  // In cells from the keys' top left corner, half a gap beyond them, less the cells to the center of 5: one and a half.
  return {
    x: ((x - keys.left + gaps.column / 2) / (keys.width + gaps.column)) * COLUMNS - 1.5,
    y: ((y - keys.top + gaps.row / 2) / (keys.height + gaps.row)) * ROWS - 1.5,
  };
}

/** The center of a key in a layout. */
export function keyCenter(layout: KeypadLayout, key: KeypadKey): KeypadPoint {
  const position = KEY_POSITIONS[layout].find((position) => position.key === key);
  return { x: (position?.column ?? 0) - 1, y: (position?.row ?? 0) - 1 };
}

/**
 * The key at a point on the keypad in a layout, or null in an empty cell. Each key's cell reaches halfway to the next
 * keys, so the gaps between keys and their rounded corners count as part of the nearest key, and the keys on the edges
 * reach out as far as the point goes: those at the sides sideways, those on top up, and those at the bottom down.
 */
export function keyAt(layout: KeypadLayout, point: KeypadPoint): KeypadKey | null {
  const column = cell(point.x + 1, COLUMNS);
  const row = cell(point.y + 1, ROWS);
  return (
    KEY_POSITIONS[layout].find((position) => position.row === row && position.column === column)
      ?.key ?? null
  );
}

/** The cell at a position counted in cells from the first one's center, those beyond the ends counting as the nearest. */
function cell(position: number, count: number): number {
  return Math.min(Math.max(Math.round(position), 0), count - 1);
}

/**
 * Whether a point on the keypad in a layout is near a key: in its own cell, which reaches halfway to the next keys, or at
 * most `reach` steps beyond it, sideways or up and down, as in a square around the key.
 */
export function isNearKey(
  layout: KeypadLayout,
  key: KeypadKey,
  point: KeypadPoint,
  reach: number,
): boolean {
  const center = keyCenter(layout, key);
  const limit = 0.5 + reach;
  return Math.abs(point.x - center.x) <= limit && Math.abs(point.y - center.y) <= limit;
}
