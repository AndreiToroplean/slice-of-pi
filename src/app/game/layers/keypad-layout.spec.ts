import { DIGITS } from '../pi/digit';
import { KEY_POSITIONS, KEYPAD_LAYOUTS, KeypadLayout, keyAt } from './keypad-layout';

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

describe('keyAt', () => {
  // A 300 × 400 keypad at (10, 20): 100 × 100 cells, touched 30 beyond it on its sides, 20 above and 40 below.
  const keys = { left: 10, top: 20, width: 300, height: 400 };
  const area = { left: -20, top: 0, width: 360, height: 460 };
  const at = (x: number, y: number, layout: KeypadLayout = 'calculator'): string | null =>
    keyAt(layout, keys, { column: 0, row: 0 }, area, x, y);

  it('finds the key whose cell contains the point', () => {
    expect(at(60, 70)).toBe('7');
    expect(at(160, 170)).toBe('5');
    expect(at(260, 270)).toBe('3');
    expect(at(160, 370)).toBe('0');
    expect(at(260, 370)).toBe('backspace');
  });

  it('splits the space between keys equally, up to the cell borders', () => {
    expect(at(109.9, 70)).toBe('7');
    expect(at(110, 70)).toBe('8');
    expect(at(60, 119.9)).toBe('7');
    expect(at(60, 120)).toBe('4');
  });

  it('splits the gaps between keys in their middle', () => {
    // Keys 80 × 70, 30 apart across and 40 down: 7 ends at 90 across and 90 down, 8 starts at 120 and 4 at 130.
    const atGaps = (x: number, y: number): string | null =>
      keyAt('calculator', keys, { column: 30, row: 40 }, area, x, y);

    expect(atGaps(104.9, 50)).toBe('7');
    expect(atGaps(105, 50)).toBe('8');
    expect(atGaps(50, 109.9)).toBe('7');
    expect(atGaps(50, 110)).toBe('4');
    expect(atGaps(339.9, 459.9)).toBe('backspace');
  });

  it('finds the keys where the layout puts them', () => {
    expect(at(60, 70, 'telephone')).toBe('1');
    expect(at(260, 270, 'telephone')).toBe('9');
    expect(at(160, 370, 'telephone')).toBe('0');
  });

  it('counts the corners of a cell, where a rounded key draws nothing, as the key', () => {
    expect(at(10, 20)).toBe('7');
    expect(at(309.9, 419.9)).toBe('backspace');
  });

  it('lets the keys on the edges reach out to the edges of the area', () => {
    expect(at(-20, 170)).toBe('4');
    expect(at(339.9, 170)).toBe('6');
    expect(at(160, 0)).toBe('8');
    expect(at(160, 459.9)).toBe('0');
    expect(at(339.9, 459.9)).toBe('backspace');
    expect(at(-20, 0)).toBe('7');
  });

  it('finds no key in the empty cell, nor below or beside it, nor outside the area', () => {
    expect(at(60, 370)).toBeNull();
    expect(at(60, 450)).toBeNull();
    expect(at(-10, 370)).toBeNull();
    expect(at(-21, 70)).toBeNull();
    expect(at(340, 70)).toBeNull();
    expect(at(60, -1)).toBeNull();
    expect(at(160, 460)).toBeNull();
  });
});
