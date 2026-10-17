/** A saved record, as read from storage or a backup file, before it's checked against what it should be. */
export type SavedRecord = Readonly<Record<string, unknown>>;

/** One migration step: brings a record from one format to the next. The format itself is set by {@link migrate}. */
export type Migration = (record: SavedRecord) => SavedRecord;

/**
 * How saved data is migrated. Each part of the save (a run, a backup file, each setting) carries
 * the format it was written in, a whole number, and has its own migration steps: `steps[0]` brings format 1 to 2,
 * `steps[1]` format 2 to 3, and so on, so the current format is one more than the number of steps. A record runs
 * through every step from its format up to the current one, in order: one in format 3 of 5 goes through 3 → 4, then
 * 4 → 5. A record without a format is in format 1. A record in the current format, or in one this version of the game
 * doesn't know, comes out as it is.
 */
export function migrate(record: object, steps: readonly Migration[]): SavedRecord {
  let migrated = record as SavedRecord;
  if (migrated['format'] === undefined) {
    migrated = { ...migrated, format: 1 };
  }
  let format = migrated['format'];
  while (isFormat(format) && format <= steps.length) {
    const step = steps[format - 1];
    if (step === undefined) {
      break;
    }
    migrated = { ...step(migrated), format: format + 1 };
    format = migrated['format'];
  }
  return migrated;
}

/** Whether a record is in an older format than `current`, to be migrated; one without a format is in format 1. */
export function isOlderFormat(value: unknown, current: number): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { format = 1 } = value as SavedRecord;
  return isFormat(format) && format < current;
}

function isFormat(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}
