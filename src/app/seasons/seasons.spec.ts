import { mix, PLACES_PER_SEASON, PLACES_PER_YEAR, seasonAt } from './seasons';

describe('seasonAt', () => {
  it('starts in spring of year 1', () => {
    expect(seasonAt(0)).toMatchObject({
      season: 'spring',
      year: 1,
      placeInYear: 0,
      seasonProgress: [0, 0, 0, 0],
    });
  });

  it('goes through the four seasons, 25 places each', () => {
    expect(PLACES_PER_SEASON).toBe(25);
    expect([0, 24, 25, 49, 50, 74, 75, 99].map((places) => seasonAt(places).season)).toEqual([
      'spring',
      'spring',
      'summer',
      'summer',
      'autumn',
      'autumn',
      'winter',
      'winter',
    ]);
  });

  it('starts a new year every 100 places', () => {
    expect(PLACES_PER_YEAR).toBe(100);
    expect(seasonAt(99)).toMatchObject({ year: 1, placeInYear: 99 });
    expect(seasonAt(100)).toMatchObject({ season: 'spring', year: 2, placeInYear: 0 });
    expect(seasonAt(1234)).toMatchObject({ season: 'summer', year: 13, placeInYear: 34 });
  });

  it('fills the year bar one season at a time', () => {
    expect(seasonAt(10).seasonProgress).toEqual([0.4, 0, 0, 0]);
    expect(seasonAt(25).seasonProgress).toEqual([1, 0, 0, 0]);
    expect(seasonAt(60).seasonProgress).toEqual([1, 1, 0.4, 0]);
    expect(seasonAt(99).seasonProgress).toEqual([1, 1, 1, 0.96]);
  });

  it('repeats every year', () => {
    for (const places of [0, 13, 24, 50, 99]) {
      expect(seasonAt(places + 300).background).toEqual(seasonAt(places).background);
    }
  });

  it('gives each season its own background', () => {
    const starts = [0, 25, 50, 75].map((places) => seasonAt(places).background.join());
    expect(new Set(starts).size).toBe(4);
    for (const places of [0, 37, 99]) {
      for (const color of seasonAt(places).background) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe('mix', () => {
  it('goes from the first color to the second', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#ff0010', '#00ff10', 0.25)).toBe('#bf4010');
  });
});
