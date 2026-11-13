import { GAME_VALUES } from '../game-values';

/**
 * How much of an unavailable candy button's paint shows, its face, edge, shade and label, in percent, as
 * `--unavailable` (see `candy.css`): its frosted glass stays whole, as fading it would let the sharp background through.
 */
export const UNAVAILABLE = GAME_VALUES.unavailable;

/** Whether a value is how much of an unavailable button's paint shows: a whole percent, from 0 to 100. */
export function isUnavailable(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 100;
}
