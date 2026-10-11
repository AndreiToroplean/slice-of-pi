import { ColorSpace, mix } from '../colors/color-spaces';

/** The four seasons of a year, in order. */
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

export type Season = (typeof SEASONS)[number];

/** Places in one year: 100 places make a year of four seasons (`vision.md` §5.4). */
export const PLACES_PER_YEAR = 100;
/** Places in one season. */
export const PLACES_PER_SEASON = PLACES_PER_YEAR / SEASONS.length;

/** A pair of background colors, top then bottom, as `#rrggbb`. */
export type BackgroundColors = readonly [top: string, bottom: string];

/** Each season's background at its start (`early`) and once it has drifted, just before it turns into the next season. */
export type SeasonBackgrounds = Readonly<
  Record<Season, { readonly early: BackgroundColors; readonly late: BackgroundColors }>
>;

/** The seasons' backgrounds, unless tuned in developer mode. */
export const SEASON_BACKGROUNDS: SeasonBackgrounds = {
  spring: { early: ['#ffb3d1', '#7fd6a6'], late: ['#ff9fc4', '#5fc993'] },
  summer: { early: ['#ffc35a', '#38b6ea'], late: ['#ffab3d', '#1fa2df'] },
  autumn: { early: ['#ee8a45', '#9b4f86'], late: ['#d9683a', '#7a3f78'] },
  winter: { early: ['#9bb4dc', '#46598f'], late: ['#8299c9', '#30406f'] },
};

/**
 * The color space the background blends its colors in, unless tuned in developer mode (see `color-spaces.ts`): OKLCH
 * keeps the middle tones between seasons, and from the top of the screen to its bottom, saturated and evenly lit.
 */
export const SEASON_COLOR_SPACE: ColorSpace = 'oklch';

/** Fraction of a season after which it turns into the next one; before that, it only drifts. */
const TURN_START = 0.8;

/** Where the player is in the year after typing `places` places, and what the screen looks like there. */
export interface SeasonView {
  readonly season: Season;
  /** The year, starting at 1. */
  readonly year: number;
  /** Places typed in the current year, from 0 to 99. */
  readonly placeInYear: number;
  /** How full each season's part of the year bar is, from 0 to 1. */
  readonly seasonProgress: readonly number[];
  readonly background: BackgroundColors;
}

/**
 * The season and background after typing `places` places.
 *
 * A season holds its colors, drifting slightly from its early to its late colors over its first 80%, then turns into
 * the next season's early colors over its last 20%, blending them in `space`. The colors are decorative and free to
 * tune; what must not change is the structure: a year is 100 places, split into four equal seasons.
 */
export function seasonAt(
  places: number,
  backgrounds: SeasonBackgrounds = SEASON_BACKGROUNDS,
  space: ColorSpace = SEASON_COLOR_SPACE,
): SeasonView {
  const placeInYear = places % PLACES_PER_YEAR;
  const index = Math.floor(placeInYear / PLACES_PER_SEASON);
  const season = seasonByIndex(index);
  const next = seasonByIndex((index + 1) % SEASONS.length);
  const t = (placeInYear % PLACES_PER_SEASON) / PLACES_PER_SEASON;
  const drift = Math.min(1, t / TURN_START);
  const turn = smoothstep(TURN_START, 1, t);
  const { early, late } = backgrounds[season];
  const target = backgrounds[next].early;
  const color = (k: 0 | 1): string =>
    mix(mix(early[k], late[k], drift, space), target[k], turn, space);
  return {
    season,
    year: Math.floor(places / PLACES_PER_YEAR) + 1,
    placeInYear,
    seasonProgress: SEASONS.map((_, q) =>
      Math.min(1, Math.max(0, (placeInYear - q * PLACES_PER_SEASON) / PLACES_PER_SEASON)),
    ),
    background: [color(0), color(1)],
  };
}

function seasonByIndex(index: number): Season {
  const season = SEASONS[index];
  if (season === undefined) {
    throw new RangeError(`No season ${String(index)}`);
  }
  return season;
}

/** Smooth step from 0 at `edge0` to 1 at `edge1`. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function channels(color: string): number[] {
  return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
}

/**
 * The seasons' backgrounds from their starting colors only: each season drifts from them as far, channel by channel, as
 * it does in {@link SEASON_BACKGROUNDS}.
 */
export function backgroundsFrom(
  early: Readonly<Record<Season, BackgroundColors>>,
): SeasonBackgrounds {
  const drift = (season: Season, k: 0 | 1): string => {
    const start = channels(early[season][k]);
    const from = channels(SEASON_BACKGROUNDS[season].early[k]);
    const to = channels(SEASON_BACKGROUNDS[season].late[k]);
    return hex(start.map((value, i) => value + (to[i] ?? 0) - (from[i] ?? 0)));
  };
  const season = (name: Season): { early: BackgroundColors; late: BackgroundColors } => ({
    early: early[name],
    late: [drift(name, 0), drift(name, 1)],
  });
  return {
    spring: season('spring'),
    summer: season('summer'),
    autumn: season('autumn'),
    winter: season('winter'),
  };
}

/** A `#rrggbb` color from its channels, each kept between 0 and 255. */
function hex(values: readonly number[]): string {
  return `#${values
    .map((value) =>
      Math.min(255, Math.max(0, Math.round(value)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
