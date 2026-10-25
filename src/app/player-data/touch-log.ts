import {
  DEFAULT_KEYPAD_LAYOUT,
  KEYPAD_LAYOUTS,
  KeypadKey,
  KeypadLayout,
  KeypadTouch,
} from '../game/layers/keypad-layout';
import { isDigit } from '../game/pi/digit';
import { migrate, Migration, SavedRecord } from './migration';

/**
 * The format of touch logs. Stored touch logs and backup files carry it. Bump it whenever the shape of a touch log
 * changes, with a step in {@link TOUCH_LOG_MIGRATIONS} (see {@link migrate}). Code that finds a record in a newer format
 * than it knows (written by a pull request preview sharing the site's storage) leaves it alone rather than misreading
 * it. It carries on from the runs' format, which touch logs replaced.
 */
export const TOUCH_LOG_FORMAT = 5;

/**
 * A touch on the keypad, or a key typed without touching it, in a touch log: what it typed, if anything, where it
 * started, for a touch, and when (see {@link KeypadTouch}).
 */
export type Touch = KeypadTouch & {
  /** When it was released, or the key typed, in whole milliseconds since the log's first digit. */
  readonly time: number;
};

/** What a touch log holds (see {@link TouchLog}). */
interface TouchLogFields {
  readonly format: typeof TOUCH_LOG_FORMAT;
  readonly id: string;
  /**
   * Whether the game checked each digit as it was typed, so the run only holds decimals of π. Runs played without
   * checking, in developer mode, aren't, nor are those from before the game checked digits: they may hold mistakes.
   */
  readonly checked: boolean;
  /** The keypad layout the run was played on: where each key was. Runs from before players could pick it were on a calculator's. */
  readonly keypadLayout: KeypadLayout;
  /** When the run started, with its first digit, in milliseconds since the Unix epoch. */
  readonly startedAt: number;
  /**
   * Every touch on the keypad, and every key typed without touching it, in order, from the first digit: those typing
   * digits, wrong ones included, those typing backspace, and those typing nothing.
   */
  readonly touches: readonly Touch[];
}

declare const touchLogBrand: unique symbol;

/**
 * The raw record of a run, as it's stored: every touch on the keypad, and every key typed, from its first digit (see
 * {@link Touch}). The run itself, its digits and their timings, is derived from it (`runOf` in `run.ts`); so is anything else,
 * such as where the player's fingers land.
 */
export type TouchLog = TouchLogFields & { readonly [touchLogBrand]: true };

/** A touch log with no touches yet, checked and on the default keypad layout unless said otherwise. */
export function newTouchLog(
  id: string,
  startedAt: number,
  checked = true,
  keypadLayout: KeypadLayout = DEFAULT_KEYPAD_LAYOUT,
): TouchLog {
  return touchLog({
    format: TOUCH_LOG_FORMAT,
    id,
    checked,
    keypadLayout,
    startedAt,
    touches: [],
  });
}

/**
 * The touch log with one more touch, `time` milliseconds after its first digit, in whole milliseconds, and where it
 * started, for a touch, to a thousandth of a step.
 */
export function addTouch(log: TouchLog, touch: KeypadTouch, time: number): TouchLog {
  const thousandths = (value: number): number => Math.round(value * 1000) / 1000;
  const added: Touch =
    'x' in touch
      ? { key: touch.key, x: thousandths(touch.x), y: thousandths(touch.y), time: Math.round(time) }
      : { key: touch.key, time: Math.round(time) };
  return touchLog({ ...log, touches: [...log.touches, added] });
}

/**
 * Reads a touch log from untrusted data (storage, a backup file): the touch log if it's a valid one in a known format,
 * migrated to the current one, runs from before touch logs included.
 */
export function parseTouchLog(value: unknown): TouchLog | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { format, id, checked, keypadLayout, startedAt, touches } = migrate(
    value,
    TOUCH_LOG_MIGRATIONS,
  );
  if (
    format !== TOUCH_LOG_FORMAT ||
    typeof id !== 'string' ||
    id === '' ||
    typeof checked !== 'boolean' ||
    !isKeypadLayout(keypadLayout) ||
    !isTime(startedAt) ||
    !Array.isArray(touches)
  ) {
    return undefined;
  }
  const read = touches.map(touchOf);
  if (!read.every((touch, i) => touch !== undefined && touch.time >= (read[i - 1]?.time ?? 0))) {
    return undefined;
  }
  return touchLog({
    format,
    id,
    checked,
    keypadLayout,
    startedAt,
    touches: read as Touch[],
  });
}

/** The steps that bring touch logs in older formats, and runs before them, to the current one (see {@link migrate}). */
export const TOUCH_LOG_MIGRATIONS: readonly Migration[] = [
  // Format 1 runs are from before the game checked digits.
  (run) => ({ ...run, checked: false }),
  // Format 2 runs are from before players could pick the keypad layout: they played on a calculator's.
  (run) => ({ ...run, keypadLayout: 'calculator' }),
  // Format 3 runs only kept the digits kept and their times: each becomes a key typed, with no place on the keypad,
  // and the places of the digits deleted are left out.
  touchesOfRun,
  // Format 4 touch logs placed each touch where it was released, rather than where it started: the places are dropped,
  // and with them the touches typing nothing, which had nothing else to them.
  withoutPlaces,
];

/** A format 4 touch log without the places of its touches: each a key typed, those typing nothing left out. */
function withoutPlaces(record: SavedRecord): SavedRecord {
  const { touches } = record;
  if (!Array.isArray(touches)) {
    return record;
  }
  return {
    ...record,
    touches: touches.flatMap((touch: unknown) => {
      if (typeof touch !== 'object' || touch === null) {
        return [touch];
      }
      const { key, time } = touch as Record<string, unknown>;
      return key === null ? [] : [{ key, time }];
    }),
  };
}

/** A format 3 run as a touch log: each of its digits a key typed at its time. */
function touchesOfRun(record: SavedRecord): SavedRecord {
  const { digits, times } = record;
  const run = Object.fromEntries(
    Object.entries(record).filter(([name]) => !['digits', 'times', 'backspaces'].includes(name)),
  );
  if (typeof digits !== 'string' || !Array.isArray(times) || times.length !== digits.length) {
    return run;
  }
  return {
    ...run,
    touches: Array.from(digits, (key, i) => ({ key, time: times[i] as unknown })),
  };
}

function touchLog(fields: TouchLogFields): TouchLog {
  return fields as TouchLog;
}

/**
 * A touch read from untrusted data, or `undefined` if invalid: a key typed with no place on the keypad, or a touch,
 * typing a key or nothing, with both coordinates.
 */
function touchOf(value: unknown): Touch | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { key, x, y, time } = value as Record<string, unknown>;
  if (!isTime(time) || !(key === null || isKey(key))) {
    return undefined;
  }
  if (x === undefined && y === undefined) {
    return key === null ? undefined : { key, time };
  }
  return isCoordinate(x) && isCoordinate(y) ? { key, x, y, time } : undefined;
}

function isKey(value: unknown): value is KeypadKey {
  return value === 'backspace' || (typeof value === 'string' && isDigit(value));
}

function isCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isKeypadLayout(value: unknown): value is KeypadLayout {
  return KEYPAD_LAYOUTS.some((layout) => layout === value);
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
