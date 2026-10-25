import { BACKUP_FORMAT, BACKUP_KIND, backupFileName, readBackup, writeBackup } from './backup';
import { newTouchLog, TOUCH_LOG_FORMAT } from './touch-log';
import { typeKey } from '../../testing/touch-logs';

describe('backup', () => {
  const runs = [
    typeKey(typeKey(newTouchLog('a', 1_000), '1', 0), '4', 250),
    typeKey(newTouchLog('b', 2_000), '1', 0),
  ];
  const settings = { 'developer-mode': { format: 1, enabled: true } };

  it('writes every run and setting in a versioned file', () => {
    expect(JSON.parse(writeBackup(runs, settings, 1_760_000_000_000))).toEqual({
      kind: BACKUP_KIND,
      format: BACKUP_FORMAT,
      exportedAt: 1_760_000_000_000,
      runs,
      settings,
    });
  });

  it('reads back the runs and settings it wrote', () => {
    expect(readBackup(writeBackup(runs, settings, 0))).toEqual({ runs, skipped: 0, settings });
  });

  it('reads a backup without runs', () => {
    expect(readBackup(writeBackup([], {}, 0))).toEqual({ runs: [], skipped: 0, settings: {} });
  });

  it.each([
    ['made before settings were kept in backups', undefined],
    ['whose settings are not settings by name', ['developer-mode']],
  ])('reads no settings from a backup %s', (_, written) => {
    const text = JSON.stringify({
      kind: BACKUP_KIND,
      format: BACKUP_FORMAT,
      runs,
      settings: written,
    });

    expect(readBackup(text)).toEqual({ runs, skipped: 0, settings: {} });
  });

  it('skips the runs it cannot read, and counts them', () => {
    const backup = JSON.parse(writeBackup(runs, {}, 0)) as Record<string, unknown>;
    backup['runs'] = [...runs, { ...runs[0], format: TOUCH_LOG_FORMAT + 1 }, 'run'];

    expect(readBackup(JSON.stringify(backup))).toEqual({ runs, skipped: 2, settings: {} });
  });

  it.each([
    ['text that is not JSON', 'runs: a, b'],
    ['JSON that is not an object', '[1, 2]'],
    ['null', 'null'],
    ['another kind of file', JSON.stringify({ kind: 'other', format: 1, runs: [] })],
    ['a backup without runs', JSON.stringify({ kind: BACKUP_KIND, format: BACKUP_FORMAT })],
  ])('turns down %s', (_, text) => {
    expect(readBackup(text)).toEqual({ error: 'This file is not a Slice of π backup.' });
  });

  it('reads a backup without a format as one of format 1', () => {
    const backup = JSON.parse(writeBackup(runs, settings, 0)) as Record<string, unknown>;
    delete backup['format'];

    expect(readBackup(JSON.stringify(backup))).toEqual({ runs, skipped: 0, settings });
  });

  it('turns down a backup in a newer format', () => {
    const text = JSON.stringify({ kind: BACKUP_KIND, format: BACKUP_FORMAT + 1, runs: [] });

    expect(readBackup(text)).toEqual({
      error: 'This backup was made by a newer version of the game.',
    });
  });

  it('names the file after the date', () => {
    expect(backupFileName(new Date(2026, 9, 10, 23, 59).getTime())).toBe(
      'slice-of-pi-2026-10-10.json',
    );
    expect(backupFileName(new Date(2027, 0, 2, 0, 1).getTime())).toBe(
      'slice-of-pi-2027-01-02.json',
    );
  });
});
