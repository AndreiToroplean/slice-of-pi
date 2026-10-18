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
  // A 300 × 400 keypad at (10, 20): 100 × 100 cells.
  const rect = { left: 10, top: 20, width: 300, height: 400 };

  it('finds the key whose cell contains the point', () => {
    expect(keyAt('calculator', rect, 60, 70)).toBe('7');
    expect(keyAt('calculator', rect, 160, 170)).toBe('5');
    expect(keyAt('calculator', rect, 260, 270)).toBe('3');
    expect(keyAt('calculator', rect, 160, 370)).toBe('0');
    expect(keyAt('calculator', rect, 260, 370)).toBe('backspace');
  });

  it('splits the space between keys equally, up to the cell borders', () => {
    expect(keyAt('calculator', rect, 109.9, 70)).toBe('7');
    expect(keyAt('calculator', rect, 110, 70)).toBe('8');
    expect(keyAt('calculator', rect, 60, 119.9)).toBe('7');
    expect(keyAt('calculator', rect, 60, 120)).toBe('4');
  });

  it('finds the keys where the layout puts them', () => {
    expect(keyAt('telephone', rect, 60, 70)).toBe('1');
    expect(keyAt('telephone', rect, 260, 270)).toBe('9');
    expect(keyAt('telephone', rect, 160, 370)).toBe('0');
  });

  it('counts the corners of a cell, where a rounded key draws nothing, as the key', () => {
    expect(keyAt('calculator', rect, 10, 20)).toBe('7');
    expect(keyAt('calculator', rect, 309.9, 419.9)).toBe('backspace');
  });

  it('finds no key in the empty cell or outside the keypad', () => {
    expect(keyAt('calculator', rect, 60, 370)).toBeNull();
    expect(keyAt('calculator', rect, 9, 70)).toBeNull();
    expect(keyAt('calculator', rect, 310, 70)).toBeNull();
    expect(keyAt('calculator', rect, 60, 19)).toBeNull();
    expect(keyAt('calculator', rect, 160, 420)).toBeNull();
  });
});
