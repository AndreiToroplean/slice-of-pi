/** How fast the game plays each round of Discover, before the player retypes it: a setting. */
export const DISCOVER_PACES = ['slower', 'medium', 'faster'] as const;

export type DiscoverPace = (typeof DISCOVER_PACES)[number];

export const DEFAULT_DISCOVER_PACE: DiscoverPace = 'medium';

/** How many digits a second the game plays at the medium pace: a little slower than a player types what they know. */
export const DISCOVER_SPEED = 2.3;
/** The slowest and fastest medium speeds developer mode can tune, in digits a second. */
export const DISCOVER_SPEEDS = { min: 0.5, max: 8 } as const;

/** How much slower or faster than the medium pace the others are, in percent of its speed. */
export const PACE_STEP = 30;
/** The largest step developer mode can tune, in percent. */
export const MAX_PACE_STEP = 90;

/**
 * The time between two digits the game plays at a pace, in milliseconds: at `speed` digits a second for the medium
 * pace, `step` percent slower or faster for the others.
 */
export function paceInterval(pace: DiscoverPace, speed = DISCOVER_SPEED, step = PACE_STEP): number {
  const factor = { slower: 1 - step / 100, medium: 1, faster: 1 + step / 100 }[pace];
  return 1000 / (speed * factor);
}

export function isDiscoverPace(value: unknown): value is DiscoverPace {
  return DISCOVER_PACES.some((pace) => pace === value);
}

/** Whether a value is a medium speed developer mode can tune. */
export function isDiscoverSpeed(value: unknown): value is number {
  return typeof value === 'number' && value >= DISCOVER_SPEEDS.min && value <= DISCOVER_SPEEDS.max;
}

/** Whether a value is a pace step developer mode can tune. */
export function isPaceStep(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= MAX_PACE_STEP;
}
