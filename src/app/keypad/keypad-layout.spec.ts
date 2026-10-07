import { DIGITS } from '../digit';
import { KEYPAD_LAYOUT, keyAt } from './keypad-layout';

describe('KEYPAD_LAYOUT', () => {
  it('has exactly one key per digit, and a backspace key', () => {
    expect(KEYPAD_LAYOUT.map((position) => position.key).sort()).toEqual([...DIGITS, 'backspace']);
  });

  it('puts no two keys in the same cell', () => {
    const cells = new Set(
      KEYPAD_LAYOUT.map((position) => `${String(position.row)},${String(position.column)}`),
    );
    expect(cells.size).toBe(KEYPAD_LAYOUT.length);
  });

  it('is laid out like a calculator with 0 at the bottom middle and backspace at the bottom right', () => {
    const grid = [0, 1, 2, 3].map((row) =>
      [0, 1, 2]
        .map((column) => {
          const key = KEYPAD_LAYOUT.find(
            (position) => position.row === row && position.column === column,
          )?.key;
          return key === 'backspace' ? '⌫' : (key ?? '_');
        })
        .join(''),
    );
    expect(grid).toEqual(['789', '456', '123', '_0⌫']);
  });
});

describe('keyAt', () => {
  // A 300 × 400 keypad at (10, 20): 100 × 100 cells.
  const rect = { left: 10, top: 20, width: 300, height: 400 };

  it('finds the key whose cell contains the point', () => {
    expect(keyAt(rect, 60, 70)).toBe('7');
    expect(keyAt(rect, 160, 170)).toBe('5');
    expect(keyAt(rect, 260, 270)).toBe('3');
    expect(keyAt(rect, 160, 370)).toBe('0');
    expect(keyAt(rect, 260, 370)).toBe('backspace');
  });

  it('splits the space between keys equally, up to the cell borders', () => {
    expect(keyAt(rect, 109.9, 70)).toBe('7');
    expect(keyAt(rect, 110, 70)).toBe('8');
    expect(keyAt(rect, 60, 119.9)).toBe('7');
    expect(keyAt(rect, 60, 120)).toBe('4');
  });

  it('counts the corners of a cell, where a rounded key draws nothing, as the key', () => {
    expect(keyAt(rect, 10, 20)).toBe('7');
    expect(keyAt(rect, 309.9, 419.9)).toBe('backspace');
  });

  it('finds no key in the empty cell or outside the keypad', () => {
    expect(keyAt(rect, 60, 370)).toBeNull();
    expect(keyAt(rect, 9, 70)).toBeNull();
    expect(keyAt(rect, 310, 70)).toBeNull();
    expect(keyAt(rect, 60, 19)).toBeNull();
    expect(keyAt(rect, 160, 420)).toBeNull();
  });
});
