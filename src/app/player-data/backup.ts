import { migrate, Migration } from './migration';
import { parseTouchLog, TouchLog } from './touch-log';

/** What a backup file says it is, so that any other file is turned down. */
export const BACKUP_KIND = 'slice-of-pi-backup';
/**
 * The format of backup files: bump it whenever their shape changes in a way older versions of the game would misread,
 * with a step in {@link BACKUP_MIGRATIONS}. Adding the settings didn't: older versions ignore them.
 */
export const BACKUP_FORMAT = 1;

/** The steps that bring backups in older formats to the current one, one per format (see {@link migrate}). */
export const BACKUP_MIGRATIONS: readonly Migration[] = [];

/** A backup of the player's data: everything in the database, the touch logs of their runs and settings, as stored. */
export interface Backup {
  readonly kind: typeof BACKUP_KIND;
  readonly format: typeof BACKUP_FORMAT;
  /** When the backup was made, in milliseconds since the Unix epoch. */
  readonly exportedAt: number;
  /** The touch log of each run, under the name runs were kept under before touch logs replaced them. */
  readonly runs: readonly TouchLog[];
  /** Every setting, by name, each in its own format; missing from backups made before settings were kept in them. */
  readonly settings: Settings;
}

/** Settings by name, as stored. */
export type Settings = Readonly<Record<string, unknown>>;

/** What a backup file holds, or why it can't be read. */
export type BackupContents =
  | {
      readonly runs: readonly TouchLog[];
      /** Runs in the file that aren't valid touch logs, or runs from before them, in a known format. */
      readonly skipped: number;
      readonly settings: Settings;
    }
  | { readonly error: string };

/** The text of a backup file holding the touch logs of these runs, and these settings. */
export function writeBackup(
  runs: readonly TouchLog[],
  settings: Settings,
  exportedAt: number,
): string {
  const backup: Backup = { kind: BACKUP_KIND, format: BACKUP_FORMAT, exportedAt, runs, settings };
  return JSON.stringify(backup);
}

/** The name of a backup file made at this date, in the player's time zone: `slice-of-pi-2026-10-10.json`. */
export function backupFileName(exportedAt: number): string {
  const date = new Date(exportedAt);
  const twoDigits = (value: number): string => String(value).padStart(2, '0');
  return `slice-of-pi-${String(date.getFullYear())}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}.json`;
}

/** Reads the text of a backup file. */
export function readBackup(text: string): BackupContents {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { error: 'This file is not a Slice of π backup.' };
  }
  if (typeof value !== 'object' || value === null) {
    return { error: 'This file is not a Slice of π backup.' };
  }
  const { kind, format, runs, settings } = migrate(value, BACKUP_MIGRATIONS);
  if (kind !== BACKUP_KIND || !Array.isArray(runs)) {
    return { error: 'This file is not a Slice of π backup.' };
  }
  if (format !== BACKUP_FORMAT) {
    return { error: 'This backup was made by a newer version of the game.' };
  }
  const parsed = runs.map(parseTouchLog).filter((log) => log !== undefined);
  // Each setting is checked by what reads it, as when it's read from the database.
  const isSettings = typeof settings === 'object' && settings !== null && !Array.isArray(settings);
  return {
    runs: parsed,
    skipped: runs.length - parsed.length,
    settings: isSettings ? (settings as Settings) : {},
  };
}
