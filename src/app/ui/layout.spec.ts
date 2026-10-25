import { LAYOUT, layoutStyles, parseLayout } from './layout';

describe('layout', () => {
  it('lays out up and down in hundredths of the screen’s height', () => {
    const styles = layoutStyles(LAYOUT);

    expect(styles['--keypad-height']).toBe('calc(32.4 * var(--unit))');
    expect(styles['--slots-bottom']).toBe('calc(37.4 * var(--unit))');
  });

  it('lays the keypad out across in hundredths of the column’s width, within the side margins', () => {
    const styles = layoutStyles({ ...LAYOUT, keypad: { height: 30, width: 80 } });

    expect(styles['--keypad-width']).toBe(
      'min(80 * var(--column) / 100, var(--column) - 2 * var(--space-3))',
    );
  });

  it('reads a stored layout, leaving out what isn’t one', () => {
    expect(parseLayout(LAYOUT)).toEqual(LAYOUT);
    expect(parseLayout({ ...LAYOUT, other: 1, header: { ...LAYOUT.header, other: 2 } })).toEqual(
      LAYOUT,
    );
    expect(parseLayout({ ...LAYOUT, keypad: { height: -1, width: 100 } })).toBeUndefined();
    expect(parseLayout({ ...LAYOUT, keypad: { height: 30, width: 101 } })).toBeUndefined();
    expect(parseLayout({ ...LAYOUT, keypad: { height: 30 } })).toBeUndefined();
    expect(parseLayout({ ...LAYOUT, slots: 'up' })).toBeUndefined();
    expect(parseLayout(null)).toBeUndefined();
  });
});
