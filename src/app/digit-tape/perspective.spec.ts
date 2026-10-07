import { approach, placeDigits, tapeGeometry, TapeGeometry } from './perspective';

describe('tapeGeometry', () => {
  const phone = tapeGeometry(390, 500);
  const desktop = tapeGeometry(1280, 450);

  it('fills the width with an odd number of equal columns', () => {
    for (const geometry of [phone, desktop]) {
      expect(geometry.columns % 2).toBe(1);
      expect(geometry.columns * geometry.cellWidth).toBeCloseTo(geometry.width);
      expect(geometry.centerColumn).toBe((geometry.columns - 1) / 2);
    }
  });

  it('sizes the main row font with the screen, within bounds', () => {
    expect(phone.fontSize).toBeGreaterThan(40);
    expect(phone.fontSize).toBeLessThan(72 * 1.2);
    expect(desktop.fontSize).toBeLessThan(72 * 1.1);
  });

  it('keeps at least 5 columns on a very narrow tape', () => {
    expect(tapeGeometry(100, 400).columns).toBe(5);
  });

  it('puts the full-size, fully opaque main row first, near the bottom', () => {
    const main = phone.rows[0];

    expect(main).toEqual({
      index: 0,
      scale: 1,
      opacity: 1,
      centerY: 500 - phone.lineHeight * 0.75,
    });
  });

  it('makes each row smaller, fainter and higher than the one in front of it, without overlapping it', () => {
    for (const geometry of [phone, desktop]) {
      expect(geometry.rows.length).toBeGreaterThan(5);
      geometry.rows.slice(1).forEach((row, i) => {
        const front = geometry.rows[i];
        if (front === undefined) {
          throw new Error('missing row');
        }
        expect(row.index).toBe(front.index + 1);
        expect(row.scale).toBeLessThan(front.scale);
        expect(row.opacity).toBeLessThan(front.opacity);
        expect(front.centerY - row.centerY).toBeCloseTo(
          (geometry.lineHeight * (front.scale + row.scale)) / 2,
        );
      });
    }
  });

  it('shrinks rows by a constant ratio', () => {
    const [, first, second] = phone.rows;

    expect(second?.scale).toBeCloseTo((first?.scale ?? 0) ** 2);
  });

  it('fades rows with exponential haze over their distance, 1 where rows are half size', () => {
    for (const row of phone.rows) {
      expect(row.opacity).toBeCloseTo(Math.exp(-0.3 * (1 / row.scale - 1)));
    }
  });

  it('recedes towards a horizon near the top of the tape', () => {
    for (const [geometry, height] of [
      [phone, 500],
      [desktop, 450],
    ] as const) {
      const farthest = geometry.rows.at(-1);
      expect(farthest?.centerY).toBeGreaterThanOrEqual(0);
      expect(farthest?.centerY).toBeLessThan(height * 0.2);
    }
  });

  it('stops at rows too small or too faint to see', () => {
    for (const geometry of [phone, desktop, tapeGeometry(390, 5000)]) {
      const farthest = geometry.rows.at(-1);
      expect(geometry.rows.length).toBeLessThanOrEqual(40);
      expect((farthest?.scale ?? 0) * geometry.fontSize).toBeGreaterThanOrEqual(3);
      expect(farthest?.opacity).toBeGreaterThanOrEqual(0.03);
    }
  });

  it('still has a main row on a very short tape', () => {
    expect(tapeGeometry(390, 60).rows.map((row) => row.index)).toEqual([0]);
  });
});

describe('placeDigits', () => {
  // 5 columns, center column 2, rows of scale 1, 0.5, 0.25.
  const geometry: TapeGeometry = {
    width: 100,
    columns: 5,
    centerColumn: 2,
    cellWidth: 20,
    lineHeight: 40,
    fontSize: 30,
    rows: [
      { index: 0, scale: 1, centerY: 200, opacity: 1 },
      { index: 1, scale: 0.5, centerY: 170, opacity: 0.7 },
      { index: 2, scale: 0.25, centerY: 155, opacity: 0.4 },
    ],
  };

  it('places nothing when no digit is typed', () => {
    expect(placeDigits(geometry, 0, -1)).toEqual([[], [], []]);
  });

  it('puts the newest digit in the center column of the main row and older ones to its left', () => {
    expect(placeDigits(geometry, 3, 2)).toEqual([
      [
        { position: 0, column: 0 },
        { position: 1, column: 1 },
        { position: 2, column: 2 },
      ],
      [],
      [],
    ]);
  });

  it('wraps older digits onto the rows behind, in reading order', () => {
    const [main, second, third] = placeDigits(geometry, 13, 12);

    expect(main?.map((digit) => digit.position)).toEqual([10, 11, 12]);
    expect(second?.map((digit) => digit.position)).toEqual([5, 6, 7, 8, 9]);
    expect(third?.map((digit) => digit.position)).toEqual([0, 1, 2, 3, 4]);
    expect(second?.map((digit) => digit.column)).toEqual([0, 1, 2, 3, 4]);
  });

  it('places a digit wrapping between rows on both, partly beyond each edge', () => {
    // Halfway through sliding from head 11 to head 12: position 9 goes from column 0 on the main row to column 4 on the
    // row behind.
    const [main, second] = placeDigits(geometry, 13, 11.5);

    expect(main?.[0]).toEqual({ position: 9, column: -0.5 });
    expect(second?.at(-1)).toEqual({ position: 9, column: 4.5 });
    expect(main?.at(-1)).toEqual({ position: 12, column: 2.5 });
  });

  it('places digits newer than the head to its right while scrolled back', () => {
    const [main] = placeDigits(geometry, 100, 50);

    expect(main?.map((digit) => digit.position)).toEqual([48, 49, 50, 51, 52]);
  });

  it('places only digits on visible rows however long the sequence', () => {
    const placed = placeDigits(geometry, 1_000_000, 999_999).flat();

    expect(placed).toHaveLength(13);
    expect(Math.min(...placed.map((digit) => digit.position))).toBe(999_999 - 12);
  });
});

describe('approach', () => {
  it('covers 63% of the distance in one time constant', () => {
    expect(approach(0, 10, 40, 40)).toBeCloseTo(10 * (1 - Math.exp(-1)));
  });

  it('moves backwards too', () => {
    expect(approach(10, 0, 40, 40)).toBeCloseTo(10 * Math.exp(-1));
  });

  it('never overshoots', () => {
    expect(approach(0, 10, 10_000, 40)).toBe(10);
  });

  it('snaps to the target once negligibly close', () => {
    expect(approach(9.9995, 10, 1, 40)).toBe(10);
  });

  it('stays still when elapsed time is zero', () => {
    expect(approach(3, 10, 0, 40)).toBe(3);
  });
});
