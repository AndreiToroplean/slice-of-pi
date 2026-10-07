import { approach, hazeOpacity, placeRows, tapeGeometry, TapeGeometry } from './perspective';

describe('tapeGeometry', () => {
  const phone = tapeGeometry(390, 500);
  const wide = tapeGeometry(1280, 450);

  it('fills the main row with an odd number of equal columns', () => {
    for (const geometry of [phone, wide]) {
      const main = geometry.rows[0];
      expect((main?.columns ?? 0) % 2).toBe(1);
      expect((main?.columns ?? 0) * geometry.cellWidth).toBeCloseTo(geometry.width);
      expect(geometry.centerColumn).toBe(((main?.columns ?? 0) - 1) / 2);
    }
  });

  it('sizes the main row font with the screen, within bounds', () => {
    expect(phone.fontSize).toBeGreaterThan(40);
    expect(phone.fontSize).toBeLessThan(72 * 1.2);
    expect(wide.fontSize).toBeLessThan(72 * 1.1);
  });

  it('keeps at least 5 columns on a very narrow tape', () => {
    expect(tapeGeometry(100, 400).rows[0]?.columns).toBe(5);
  });

  it('puts the full-size, fully opaque main row first, near the bottom', () => {
    expect(phone.rows[0]).toEqual({
      index: 0,
      scale: 1,
      columns: phone.rows[0]?.columns,
      cellsInFront: 0,
      opacity: 1,
      centerY: 500 - phone.lineHeight * 0.75,
    });
  });

  it('makes each row smaller, fainter and higher than the one in front of it, without overlapping it', () => {
    for (const geometry of [phone, wide]) {
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

  it('gives every row behind the main one enough cells to span the screen, and no more', () => {
    for (const geometry of [phone, wide]) {
      for (const row of geometry.rows.slice(1)) {
        const cell = geometry.cellWidth * row.scale;
        expect(row.columns * cell).toBeGreaterThanOrEqual(geometry.width);
        expect((row.columns - 1) * cell).toBeLessThan(geometry.width);
      }
    }
  });

  it('counts the cells in front of each row, the main row counting up to its center only', () => {
    const [, second, third, fourth] = phone.rows;

    expect(second?.cellsInFront).toBe(0);
    expect(third?.cellsInFront).toBe(second?.columns);
    expect(fourth?.cellsInFront).toBe((second?.columns ?? 0) + (third?.columns ?? 0));
  });

  it('fades rows with the haze', () => {
    for (const row of phone.rows) {
      expect(row.opacity).toBe(hazeOpacity(row.scale));
      expect(row.opacity).toBeGreaterThan(0);
    }
  });

  it('recedes towards a horizon near the top of the tape', () => {
    for (const [geometry, height] of [
      [phone, 500],
      [wide, 450],
    ] as const) {
      const farthest = geometry.rows.at(-1);
      expect(farthest?.centerY).toBeGreaterThanOrEqual(0);
      expect(farthest?.centerY).toBeLessThan(height * 0.2);
    }
  });

  it('stops at rows the haze hides or too small to see, keeping the number of drawn digits bounded', () => {
    for (const geometry of [phone, wide, tapeGeometry(390, 5000), tapeGeometry(390, 100_000)]) {
      const farthest = geometry.rows.at(-1);
      const beyond = (farthest?.scale ?? 0) * (geometry.rows[1]?.scale ?? 0);
      expect(geometry.rows.length).toBeLessThanOrEqual(40);
      expect((farthest?.scale ?? 0) * geometry.fontSize).toBeGreaterThanOrEqual(3);
      expect(hazeOpacity(beyond) === 0 || beyond * geometry.fontSize < 3).toBe(true);
      expect(geometry.rows.reduce((sum, row) => sum + row.columns, 0)).toBeLessThan(2000);
    }
  });

  it('still has a main row on a very short tape', () => {
    expect(tapeGeometry(390, 60).rows.map((row) => row.index)).toEqual([0]);
  });
});

describe('hazeOpacity', () => {
  it('lets all light through at the main row', () => {
    expect(hazeOpacity(1)).toBe(1);
  });

  it('decreases with distance', () => {
    expect(hazeOpacity(0.5)).toBeLessThan(hazeOpacity(0.8));
    expect(hazeOpacity(0.2)).toBeLessThan(hazeOpacity(0.5));
  });

  it('reaches zero visibility at a finite distance and stays there', () => {
    // exp(-0.3 * (1 / s - 1)) = 0.03 at s = 1 / (1 + ln(1 / 0.03) / 0.3), about 0.079.
    expect(hazeOpacity(0.085)).toBeGreaterThan(0);
    expect(hazeOpacity(0.075)).toBe(0);
    expect(hazeOpacity(0.001)).toBe(0);
  });
});

describe('placeRows', () => {
  // Main row of 5 columns (center 2), then rows of 8 and 16 columns.
  const geometry: TapeGeometry = {
    width: 100,
    centerColumn: 2,
    cellWidth: 20,
    lineHeight: 40,
    fontSize: 30,
    rows: [
      { index: 0, scale: 1, columns: 5, cellsInFront: 0, centerY: 200, opacity: 1 },
      { index: 1, scale: 0.625, columns: 8, cellsInFront: 0, centerY: 170, opacity: 0.7 },
      { index: 2, scale: 0.3125, columns: 16, cellsInFront: 8, centerY: 155, opacity: 0.4 },
    ],
  };

  function positions(placement: { first: number; last: number } | undefined): number[] {
    const result: number[] = [];
    for (let position = placement?.first ?? 0; position <= (placement?.last ?? -1); position++) {
      result.push(position);
    }
    return result;
  }

  it('places nothing when no digit is typed', () => {
    for (const row of placeRows(geometry, 0, -1)) {
      expect(positions(row)).toEqual([]);
    }
  });

  it('puts the newest digit in the center column of the main row and older ones to its left', () => {
    const [main, second] = placeRows(geometry, 3, 2);

    expect(positions(main)).toEqual([0, 1, 2]);
    expect(main?.offset).toBe(0);
    expect(positions(second)).toEqual([]);
  });

  it('wraps older digits onto the rows behind, filling each from its right end', () => {
    // 3 digits on the main row, 8 on the second, 16 on the third.
    const [main, second, third] = placeRows(geometry, 100, 99);

    expect(positions(main)).toEqual([97, 98, 99]);
    expect(positions(second)).toEqual([89, 90, 91, 92, 93, 94, 95, 96]);
    expect(second?.offset).toBe(-89);
    expect(positions(third)).toEqual(Array.from({ length: 16 }, (_, i) => 73 + i));
  });

  it('places a digit wrapping between rows on both, partly beyond each edge', () => {
    // Halfway through sliding from head 98 to head 99: position 97 goes from column 1 to 0 on the main row, position 96
    // from column 0 on the main row to column 7 on the row behind.
    const [main, second] = placeRows(geometry, 100, 98.5);

    expect(main?.first).toBe(96);
    expect(96 + (main?.offset ?? 0)).toBe(-0.5);
    expect(second?.last).toBe(96);
    expect(96 + (second?.offset ?? 0)).toBe(7.5);
  });

  it('places digits newer than the head to its right while scrolled back', () => {
    const [main] = placeRows(geometry, 100, 50);

    expect(positions(main)).toEqual([48, 49, 50, 51, 52]);
  });

  it('places only digits on visible rows however long the sequence', () => {
    const placements = placeRows(geometry, 1_000_000, 999_999);
    const count = placements.reduce((sum, row) => sum + row.last - row.first + 1, 0);

    expect(count).toBe(3 + 8 + 16);
    expect(placements[2]?.first).toBe(999_999 - 26);
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
