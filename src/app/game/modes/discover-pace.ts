/** How fast the game plays each round of Discover, before the player retypes it: a setting. */
export const DISCOVER_PACES = ['slower', 'medium', 'faster'] as const;

export type DiscoverPace = (typeof DISCOVER_PACES)[number];

export const DEFAULT_DISCOVER_PACE: DiscoverPace = 'medium';

/** The time between two digits at the medium pace, in milliseconds: about a player's, typing what they know. */
export const MEDIUM_INTERVAL = 300;

/** How much slower or faster than the medium pace the others are: a share of its speed. */
export const PACE_CHANGE = 0.3;

/** The time between two digits the game plays at a pace, in milliseconds. */
export function paceInterval(pace: DiscoverPace): number {
  const speed = { slower: 1 - PACE_CHANGE, medium: 1, faster: 1 + PACE_CHANGE }[pace];
  return MEDIUM_INTERVAL / speed;
}

export function isDiscoverPace(value: unknown): value is DiscoverPace {
  return DISCOVER_PACES.some((pace) => pace === value);
}
