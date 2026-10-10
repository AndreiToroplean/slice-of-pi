import { parseRun, Run } from './run';

/** What a backup file says it is, so that any other file is turned down. */
export const BACKUP_KIND = 'slice-of-pi-backup';
/** The format of backup files: bump it whenever their shape changes, and keep reading the older formats. */
export const BACKUP_FORMAT = 1;

/** A backup of the player's data: every run, as stored. */
export interface Backup {
  readonly kind: typeof BACKUP_KIND;
  readonly format: typeof BACKUP_FORMAT;
  /** When the backup was made, in milliseconds since the Unix epoch. */
  readonly exportedAt: number;
  readonly runs: readonly Run[];
}

/** What a backup file holds, or why it can't be read. */
export type BackupContents =
  | {
      readonly runs: readonly Run[];
      /** Runs in the file that aren't valid runs in a known format. */ readonly skipped: number;
    }
  | { readonly error: string };

/** The text of a backup file holding these runs. */
export function writeBackup(runs: readonly Run[], exportedAt: number): string {
  const backup: Backup = { kind: BACKUP_KIND, format: BACKUP_FORMAT, exportedAt, runs };
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
  const { kind, format, runs } = value as Partial<Record<keyof Backup, unknown>>;
  if (kind !== BACKUP_KIND || !Array.isArray(runs)) {
    return { error: 'This file is not a Slice of π backup.' };
  }
  if (format !== BACKUP_FORMAT) {
    return { error: 'This backup was made by a newer version of the game.' };
  }
  const parsed = runs.map(parseRun).filter((run) => run !== undefined);
  return { runs: parsed, skipped: runs.length - parsed.length };
}
