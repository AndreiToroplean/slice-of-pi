import { GAME_VALUES } from '../../../game-values';

/** The keys besides the digit keys: the pause key, and the key in backspace's place, backspace or the discover key. */
export const OTHER_KEYS = ['pause', 'backspace', 'discover'] as const;
export type OtherKey = (typeof OTHER_KEYS)[number];

/**
 * Each of the other keys' color, as `#rrggbb`, which its edge shows, and its face while pressed, as a digit key's,
 * though it doesn't linger.
 */
export type OtherKeyColors = Readonly<Record<OtherKey, string>>;

/** The other keys' colors (see {@link OtherKeyColors}). */
export const OTHER_KEY_COLORS = GAME_VALUES.otherKeys;
