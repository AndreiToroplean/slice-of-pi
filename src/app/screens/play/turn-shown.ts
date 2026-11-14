import { GAME_VALUES } from '../../game-values';

/**
 * How long the keypad takes to show the other turn as the player switches turns themselves, typing on the game's turn
 * or tapping the turn key, in milliseconds, rather than over the hand over, as a turn switches by itself.
 */
export const TURN_SWITCH = GAME_VALUES.turnSwitch;
/** The longest turn switch developer mode can tune, in milliseconds. */
export const MAX_TURN_SWITCH = 1000;

/** Whether a value is a turn switch developer mode can tune. */
export function isTurnSwitch(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= MAX_TURN_SWITCH;
}

/**
 * How much the keypad shows Discovery's game turn, from 0 to 1: all of it on the game's turn, none on the player's, and,
 * as a turn is handed over, `left` of the hand over left, from 1 down to 0, as much as is left of the game's, going,
 * or as is done of the player's, coming: steadily, as the time left.
 */
export function gameTurnShare(turn: 'game' | 'player', left?: number): number {
  if (left === undefined) {
    return turn === 'game' ? 1 : 0;
  }
  return turn === 'game' ? left : 1 - left;
}

/**
 * How much the keypad shows the game's turn as the player switches turns themselves: from `from`, as it showed, to
 * `to`, steadily over `duration` milliseconds, `elapsed` of them gone.
 */
export function switchedShare(from: number, to: number, elapsed: number, duration: number): number {
  const done = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 1;
  return from + (to - from) * done;
}
