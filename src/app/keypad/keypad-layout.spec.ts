import { DIGITS } from '../digit';
import { KEYPAD_LAYOUT } from './keypad-layout';

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
