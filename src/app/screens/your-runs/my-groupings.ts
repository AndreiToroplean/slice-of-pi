import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { RunStore } from '../../player-data/run-store';

/**
 * The groups the player says they make, typed in developer mode as the decimals of π with a space between groups, to
 * fit a break model to. Kept as typed among the player's settings, so that they're in the backup file too.
 */

/** The name of the setting in the store. */
export const MY_GROUPINGS = 'my-groupings';
/** The format of the stored setting. */
const MY_GROUPINGS_FORMAT = 1;

/** Only digits and spaces of any kind, as the player may type them. */
export function onlyDigitsAndSpaces(text: string): string {
  return text.replace(/[^\d\s]/g, '');
}

/** The groups in the text: split at each run of spaces, of any kind and length, leaving out those at either end. */
export function groupsIn(text: string): string[] {
  const trimmed = text.trim();
  return trimmed === '' ? [] : trimmed.split(/\s+/);
}

/** How many of π's digits before a mistake are shown with it, to find it by. */
const CONTEXT = 4;

/** A digit the player typed that isn't π's. */
export interface Mistake {
  /** Its place, from 1. */
  readonly place: number;
  /** The digit π has there. */
  readonly expected: string;
  /** π's digits just before it, to find it by. */
  readonly before: string;
}

/** The first digit in the groups that isn't π's, if any. */
export function firstMistake(groups: readonly string[]): Mistake | undefined {
  const digits = groups.join('');
  for (let i = 0; i < digits.length; i++) {
    if (digits[i] !== PI_DECIMALS[i]) {
      return {
        place: i + 1,
        expected: PI_DECIMALS[i] ?? '',
        before: PI_DECIMALS.slice(Math.max(0, i - CONTEXT), i),
      };
    }
  }
  return undefined;
}

/** The player's groupings as typed, or none. */
export async function loadMyGroupings(store: RunStore): Promise<string> {
  const stored = await store.setting(MY_GROUPINGS);
  return typeof stored === 'object' &&
    stored !== null &&
    'format' in stored &&
    stored.format === MY_GROUPINGS_FORMAT &&
    'text' in stored &&
    typeof stored.text === 'string'
    ? onlyDigitsAndSpaces(stored.text)
    : '';
}

export function saveMyGroupings(store: RunStore, text: string): Promise<void> {
  return store.saveSetting(MY_GROUPINGS, { format: MY_GROUPINGS_FORMAT, text });
}
