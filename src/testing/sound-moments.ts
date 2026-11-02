import { keyColorIndices } from '../app/game/layers/place-colors';
import { seasonOf } from '../app/game/layers/seasons';
import { Moment } from '../app/game/layers/sound/sound-model';
import { PI_DECIMALS } from '../app/game/pi/pi-decimals';

/** The moment π's digit at `place` is typed, after the right ones, in the words given, each key's color index and the season as in the game. */
export function momentAt(place: number, words: readonly number[], slots: number): Moment {
  const typed = PI_DECIMALS.slice(0, place - 1);
  return { typed, words, slots, colors: keyColorIndices(typed), season: seasonOf(typed.length) };
}
