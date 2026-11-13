import { GAME_VALUES } from '../../../game-values';

/**
 * The action keys' color, as `#rrggbb`: the keys besides the digit keys, the pause key and the key in backspace's place,
 * which act on the game rather than type a digit, all alike. Their edge shows it, and their face while pressed, as a
 * digit key's, though it doesn't linger.
 */
export const ACTION_KEY_COLOR = GAME_VALUES.actionKeys;
