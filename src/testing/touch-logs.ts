import { TypedKey } from '../app/game/layers/keypad-layout';
import { PI_DECIMALS } from '../app/game/pi/pi-decimals';
import { addTouch, newTouchLog, TouchLog } from '../app/player-data/touch-log';

/** The touch log with one more key typed, `time` milliseconds after its first digit, as on a keyboard. */
export function typeKey(log: TouchLog, key: TypedKey, time: number): TouchLog {
  return addTouch(log, { key }, time);
}

/** A touch log typing these keys, `interval` milliseconds apart, from the first. */
export function typeKeys(
  keys: readonly TypedKey[],
  log = newTouchLog('run', 1_000),
  interval = 100,
): TouchLog {
  return keys.reduce((typing, key, i) => typeKey(typing, key, i * interval), log);
}

/** The first decimals of π, as keys. */
export function decimals(count: number): TypedKey[] {
  return Array.from(PI_DECIMALS.slice(0, count)) as TypedKey[];
}
