import { GAME_VALUES } from '../../game-values';
/** How fast the game plays each round of Discover, before the player retypes it: a setting. */
export const DISCOVER_PACES = ['slower', 'medium', 'faster'] as const;

export type DiscoverPace = (typeof DISCOVER_PACES)[number];

export const DEFAULT_DISCOVER_PACE: DiscoverPace = 'medium';

/** How many digits a second the game plays at the medium pace: a little slower than a player types what they know. */
export const DISCOVER_SPEED = GAME_VALUES.discoverSpeed;
/** The slowest and fastest medium speeds developer mode can tune, in digits a second. */
export const DISCOVER_SPEEDS = { min: 0.5, max: 8 } as const;

/** How much slower or faster than the medium pace the others are, in percent of its speed. */
export const PACE_STEP = GAME_VALUES.paceStep;
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

/**
 * How long Discover takes to hand a turn over, in milliseconds. Once the game has shown the round, the digits it showed
 * fade out of the tape over it; once the player has typed the round, their digits fade out over it too, and the game
 * then shows the next one, each digit they type on starting it over, so that they can type on as far as they know.
 */
export const HAND_OVER = GAME_VALUES.handOver;
/** The longest hand over developer mode can tune, in milliseconds. */
export const MAX_HAND_OVER = 3000;

/** Whether a value is a hand over developer mode can tune. */
export function isHandOver(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= MAX_HAND_OVER;
}

/**
 * How much longer the game waits between two groups than between two digits, as it plays a round, in percent: a break,
 * as players make between their groups.
 */
export const GROUP_PAUSE = GAME_VALUES.groupPause;
/** The longest group pause developer mode can tune, in percent: twice the time between two digits. */
export const MAX_GROUP_PAUSE = 100;

/** Whether a value is a group pause developer mode can tune. */
export function isGroupPause(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= MAX_GROUP_PAUSE;
}

/**
 * How many times longer a key's color lingers as the game plays it, on Discover's turn, than as the player types it:
 * the player, watching, takes in each color.
 */
export const GAME_LINGER = GAME_VALUES.gameLinger;
/** The longest game linger developer mode can tune, as a multiple. */
export const MAX_GAME_LINGER = 5;

/** Whether a value is a game linger developer mode can tune. */
export function isGameLinger(value: unknown): value is number {
  return typeof value === 'number' && value >= 1 && value <= MAX_GAME_LINGER;
}

/** How many times faster the game plays Discover's rounds, fading them out too, while the player fast forwards them. */
export const FAST_FORWARD = 2;
