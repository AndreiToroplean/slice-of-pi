import { DIGITS } from '../digit';
import { KEYPAD_LAYOUT } from './keypad-layout';

describe('KEYPAD_LAYOUT', () => {
  it('has exactly one key per digit', () => {
    expect(KEYPAD_LAYOUT.map((key) => key.digit).sort()).toEqual([...DIGITS]);
  });

  it('puts no two keys in the same cell', () => {
    const cells = new Set(KEYPAD_LAYOUT.map((key) => `${String(key.row)},${String(key.column)}`));
    expect(cells.size).toBe(KEYPAD_LAYOUT.length);
  });

  it('is laid out like a calculator with 0 at the bottom middle', () => {
    const grid = [0, 1, 2, 3].map((row) =>
      [0, 1, 2]
        .map(
          (column) =>
            KEYPAD_LAYOUT.find((key) => key.row === row && key.column === column)?.digit ?? '_',
        )
        .join(''),
    );
    expect(grid).toEqual(['789', '456', '123', '_0_']);
  });
});
