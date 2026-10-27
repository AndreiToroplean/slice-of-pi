import { LAYOUT, layoutStyles, parseLayout } from './layout';

describe('layout', () => {
  it('lays the play screen out up and down in hundredths of the screen’s height', () => {
    const styles = layoutStyles(LAYOUT);

    expect(styles['--keypad-top']).toBe('calc(35 * var(--unit))');
    expect(styles['--slots-bottom']).toBe('calc(37.4 * var(--unit))');
    expect(styles['--header-height']).toBe('calc(10 * var(--unit))');
  });

  it('keeps the margins and corner buttons in rem', () => {
    const styles = layoutStyles({ ...LAYOUT, margins: { top: 1, side: 2, bottom: 3 } });

    expect(styles['--margin-top']).toBe('1rem');
    expect(styles['--margin-side']).toBe('2rem');
    expect(styles['--margin-bottom']).toBe('3rem');
    expect(styles['--corner-size']).toBe('2.75rem');
  });

  it('gives the tape’s tiles a slot’s proportions', () => {
    const styles = layoutStyles({
      ...LAYOUT,
      slots: { top: 46, bottom: 40, width: 9 },
      tape: { ...LAYOUT.tape, words: 3 },
    });

    expect(styles['--slot-width']).toBe('calc(9 * var(--column) / 100)');
    expect(styles['--tile-height']).toBe('calc(3 * var(--unit))');
    expect(styles['--tile-width']).toBe('calc(4.5 * var(--column) / 100)');
  });

  it('reads a stored layout, leaving out what isn’t one', () => {
    expect(parseLayout(LAYOUT)).toEqual(LAYOUT);
    expect(parseLayout({ ...LAYOUT, other: 1, header: { ...LAYOUT.header, other: 2 } })).toEqual(
      LAYOUT,
    );
    expect(parseLayout({ ...LAYOUT, keypad: { top: -1 } })).toBeUndefined();
    expect(parseLayout({ ...LAYOUT, keypad: { top: 101 } })).toBeUndefined();
    expect(parseLayout({ ...LAYOUT, keypad: {} })).toBeUndefined();
    expect(parseLayout({ ...LAYOUT, slots: 'up' })).toBeUndefined();
    expect(parseLayout(null)).toBeUndefined();
  });
});
