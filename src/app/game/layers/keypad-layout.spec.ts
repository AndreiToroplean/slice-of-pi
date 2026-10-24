import { DIGITS } from '../pi/digit';
import {
  KEY_POSITIONS,
  KEYPAD_LAYOUTS,
  KeypadLayout,
  KeypadPoint,
  keyAt,
  keyCenter,
  pointAt,
  touchPoint,
} from './keypad-layout';

describe('KEY_POSITIONS', () => {
  function grid(layout: KeypadLayout): string[] {
    return [0, 1, 2, 3].map((row) =>
      [0, 1, 2]
        .map((column) => {
          const key = KEY_POSITIONS[layout].find(
            (position) => position.row === row && position.column === column,
          )?.key;
          return key === 'backspace' ? '⌫' : (key ?? '_');
        })
        .join(''),
    );
  }

  it.each(KEYPAD_LAYOUTS)(
    'has exactly one key per digit, and a backspace key, in the %s layout',
    (layout) => {
      expect(KEY_POSITIONS[layout].map((position) => position.key).sort()).toEqual([
        ...DIGITS,
        'backspace',
      ]);
    },
  );

  it.each(KEYPAD_LAYOUTS)('puts no two keys in the same cell in the %s layout', (layout) => {
    const cells = new Set(
      KEY_POSITIONS[layout].map((position) => `${String(position.row)},${String(position.column)}`),
    );
    expect(cells.size).toBe(KEY_POSITIONS[layout].length);
  });

  it('is laid out like a calculator, with 7 on top, or like a telephone, with 1 on top, with 0 and backspace at the bottom', () => {
    expect(grid('calculator')).toEqual(['789', '456', '123', '_0⌫']);
    expect(grid('telephone')).toEqual(['123', '456', '789', '_0⌫']);
  });
});

describe('pointAt', () => {
  // A 300 × 400 grid of keys at (10, 20).
  const keys = { left: 10, top: 20, width: 300, height: 400 };

  it('measures in steps between keys from the center of 5', () => {
    const at = (x: number, y: number): KeypadPoint => pointAt(keys, { column: 0, row: 0 }, x, y);

    expect(at(160, 170)).toEqual({ x: 0, y: 0 });
    expect(at(60, 70)).toEqual({ x: -1, y: -1 });
    expect(at(260, 370)).toEqual({ x: 1, y: 2 });
    expect(at(185, 145)).toEqual({ x: 0.25, y: -0.25 });
    expect(at(-40, 470)).toEqual({ x: -2, y: 3 });
  });

  it('takes a step to be a key and a gap', () => {
    // Keys 80 × 70, 30 apart across and 40 down: 7's center at (50, 55), 5's at (160, 165).
    const at = (x: number, y: number): KeypadPoint => pointAt(keys, { column: 30, row: 40 }, x, y);

    expect(at(160, 165)).toEqual({ x: 0, y: 0 });
    expect(at(50, 55)).toEqual({ x: -1, y: -1 });
    expect(at(105, 110)).toEqual({ x: -0.5, y: -0.5 });
  });
});

describe('keyCenter', () => {
  it('finds the center of each key, in steps from the center of 5', () => {
    expect(keyCenter('calculator', '5')).toEqual({ x: 0, y: 0 });
    expect(keyCenter('calculator', '7')).toEqual({ x: -1, y: -1 });
    expect(keyCenter('telephone', '7')).toEqual({ x: -1, y: 1 });
    expect(keyCenter('telephone', 'backspace')).toEqual({ x: 1, y: 2 });
  });
});

describe('touchPoint', () => {
  it('gives where a touch was, and a key typed without touching the keypad, the center of its key', () => {
    expect(touchPoint('calculator', { key: null, x: 2.5, y: -1.25 })).toEqual({ x: 2.5, y: -1.25 });
    expect(touchPoint('calculator', { key: '7', x: -0.75, y: -1 })).toEqual({ x: -0.75, y: -1 });
    expect(touchPoint('calculator', { key: '7' })).toEqual({ x: -1, y: -1 });
    expect(touchPoint('telephone', { key: '7' })).toEqual({ x: -1, y: 1 });
  });
});

describe('keyAt', () => {
  const at = (x: number, y: number, layout: KeypadLayout = 'calculator'): string | null =>
    keyAt(layout, { x, y });

  it('finds the key whose cell holds the point', () => {
    expect(at(-1, -1)).toBe('7');
    expect(at(0, 0)).toBe('5');
    expect(at(1, 1)).toBe('3');
    expect(at(0, 2)).toBe('0');
    expect(at(1, 2)).toBe('backspace');
  });

  it('splits the space between keys halfway', () => {
    expect(at(-0.501, -1)).toBe('7');
    expect(at(-0.5, -1)).toBe('8');
    expect(at(-1, -0.501)).toBe('7');
    expect(at(-1, -0.5)).toBe('4');
  });

  it('finds the keys where the layout puts them', () => {
    expect(at(-1, -1, 'telephone')).toBe('1');
    expect(at(1, 1, 'telephone')).toBe('9');
    expect(at(0, 2, 'telephone')).toBe('0');
  });

  it('lets the keys on the edges reach as far as the point goes', () => {
    expect(at(-3, 0)).toBe('4');
    expect(at(3, 0)).toBe('6');
    expect(at(0, -3)).toBe('8');
    expect(at(0, 5)).toBe('0');
    expect(at(4, 4)).toBe('backspace');
  });

  it('finds no key in the empty cell, nor below or beside it', () => {
    expect(at(-1, 2)).toBeNull();
    expect(at(-1, 3)).toBeNull();
    expect(at(-2, 2)).toBeNull();
  });
});
