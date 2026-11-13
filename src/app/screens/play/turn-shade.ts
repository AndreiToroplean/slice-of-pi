import { SoundSlider } from '../../feedback/sound-mix';
import { GAME_VALUES } from '../../game-values';

/**
 * The shade behind the keypad on the game's turn in Discover, telling the player to look rather than type: dark at the
 * bottom of the screen, fading out up the keypad. It comes and goes with the turns, over the hand over as a turn is
 * handed over, or over `switch` as the player switches turns themselves.
 */
export interface TurnShade {
  /** How dark it is at the bottom of the screen, from 0 to 1. */
  readonly strength: number;
  /** How far up it reaches, where it's gone, as a share of the keypad's top's height, from 0. */
  readonly reach: number;
  /** How long it takes to come or go as the player switches turns, rather than as a hand over ends, in milliseconds. */
  readonly switch: number;
}

/** The game's turn shade (see {@link TurnShade}). */
export const TURN_SHADE: TurnShade = GAME_VALUES.turnShade;

const percent = (value: number): string => `${String(Math.round(value * 100))}%`;
const milliseconds = (value: number): string => `${String(Math.round(value))} ms`;

/** The sliders of the turn shade. */
export const TURN_SHADE_SLIDERS: readonly SoundSlider<TurnShade>[] = [
  { key: 'strength', label: 'Turn Shade', min: 0, max: 1, step: 0.05, format: percent },
  { key: 'reach', label: 'Shade Reach', min: 0, max: 1.5, step: 0.05, format: percent },
  { key: 'switch', label: 'Shade Switch', min: 0, max: 1000, step: 10, format: milliseconds },
];

/**
 * How much of its strength the turn shade shows, from 0 to 1: all of it on the game's turn, none on the player's, and,
 * as a turn is handed over, `left` of the hand over left, from 1 down to 0, as much as is left of the game's, going
 * out, or as is done of the player's, coming in: steadily, as the time left.
 */
export function turnShadeShown(turn: 'game' | 'player', left?: number): number {
  if (left === undefined) {
    return turn === 'game' ? 1 : 0;
  }
  return turn === 'game' ? left : 1 - left;
}
