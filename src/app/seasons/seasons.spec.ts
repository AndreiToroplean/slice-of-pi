import { hueOf, mixGradients, shortWay } from '../colors/color-spaces';
import {
  backgroundsFrom,
  PLACES_PER_SEASON,
  PLACES_PER_YEAR,
  SEASON_BACKGROUNDS,
  SEASON_TURN,
  seasonAt,
} from './seasons';

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

  it('goes back into the year before the first', () => {
    expect(seasonAt(-25)).toMatchObject({ season: 'winter', year: 0, placeInYear: 75 });
    expect(seasonAt(-1).background).toEqual(seasonAt(99).background);
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

  it('blends the colors in OKLCH, or the color space given, the same at the start of each season', () => {
    expect(seasonAt(0, SEASON_BACKGROUNDS, 'srgb').background).toEqual(seasonAt(0).background);
    // Autumn turning into winter: 22 places in, 35.2% of the way after easing.
    expect(seasonAt(72).background).toEqual(
      mixGradients(
        mixGradients(['#ee8a45', '#9b4f86'], ['#d9683a', '#7a3f78'], 1, 'oklch'),
        ['#9bb4dc', '#46598f'],
        0.352,
        'oklch',
      ),
    );
    expect(seasonAt(72, SEASON_BACKGROUNDS, 'srgb').background).not.toEqual(
      seasonAt(72).background,
    );
  });

  it('turns into the next season over its last few places, from at once to all season long', () => {
    const { spring, summer } = SEASON_BACKGROUNDS;
    // Five places by default: spring's last place is most of the way into summer.
    expect(SEASON_TURN).toBe(5);
    expect(seasonAt(24).background).toEqual(
      mixGradients(
        mixGradients(spring.early, spring.late, 1, 'oklch'),
        summer.early,
        0.896,
        'oklch',
      ),
    );
    // At once: spring has only drifted by its last place.
    expect(seasonAt(24, SEASON_BACKGROUNDS, 'oklch', 1).background).toEqual(
      mixGradients(spring.early, spring.late, 1, 'oklch'),
    );
    // All season long: no drift, halfway through spring is about halfway into summer.
    expect(seasonAt(12, SEASON_BACKGROUNDS, 'oklch', 25).background).toEqual(
      mixGradients(spring.early, summer.early, 0.48 * 0.48 * (3 - 2 * 0.48), 'oklch'),
    );
  });

  it('never flips the way the background turns round the color wheel, into the next year too', () => {
    for (const space of ['hsl', 'oklch'] as const) {
      // How far the bottom's hue is from the top's, the short way, as the browser draws the gradient.
      const turns = Array.from({ length: 2 * PLACES_PER_YEAR + 1 }, (_, places) => {
        const [top, bottom] = seasonAt(places, SEASON_BACKGROUNDS, space).background;
        return shortWay(hueOf(top, space), hueOf(bottom, space));
      });
      // Flipping would jump from about 180 degrees one way to about 180 the other.
      for (const [places, turn] of turns.entries()) {
        expect(Math.abs(turn - (turns[places + 1] ?? turn))).toBeLessThan(90);
      }
    }
  });
});

describe('backgroundsFrom', () => {
  it("gives back the game's backgrounds from their starting colors", () => {
    const starts = {
      spring: SEASON_BACKGROUNDS.spring.early,
      summer: SEASON_BACKGROUNDS.summer.early,
      autumn: SEASON_BACKGROUNDS.autumn.early,
      winter: SEASON_BACKGROUNDS.winter.early,
    };

    expect(backgroundsFrom(starts)).toEqual(SEASON_BACKGROUNDS);
  });

  it('drifts each season from new starting colors as far as the game does, within the colors there are', () => {
    const starts = {
      spring: ['#808080', '#ffffff'],
      summer: ['#000000', '#000000'],
      autumn: SEASON_BACKGROUNDS.autumn.early,
      winter: SEASON_BACKGROUNDS.winter.early,
    } as const;

    const backgrounds = backgroundsFrom(starts);

    // Spring's top drifts by 0, -20 and -13 on each channel, and its bottom by -32, -13 and -19.
    expect(backgrounds.spring).toEqual({ early: starts.spring, late: ['#806c73', '#dff2ec'] });
    expect(backgrounds.summer.late).toEqual(['#000000', '#000000']);
    expect(backgroundsFrom(starts).autumn).toEqual(SEASON_BACKGROUNDS.autumn);
  });

  it('is used by seasonAt', () => {
    const backgrounds = backgroundsFrom({
      spring: ['#000000', '#000000'],
      summer: ['#000000', '#000000'],
      autumn: ['#000000', '#000000'],
      winter: ['#000000', '#000000'],
    });

    expect(seasonAt(0, backgrounds).background).toEqual(['#000000', '#000000']);
    expect(seasonAt(0).background).toEqual(SEASON_BACKGROUNDS.spring.early);
  });
});
