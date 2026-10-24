import { KeypadKey } from '../app/game/layers/keypad-layout';
import { addTouch, TouchLog } from '../app/player-data/touch-log';

/** The touch log with one more key typed, `time` milliseconds after its first digit, as on a keyboard. */
export function typeKey(log: TouchLog, key: KeypadKey, time: number): TouchLog {
  return addTouch(log, { key }, time);
}
