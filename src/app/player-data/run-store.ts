import { DOCUMENT } from '@angular/common';
import { inject, InjectionToken, Service } from '@angular/core';
import { isOlderFormat } from './migration';
import { Run, runOf } from './run';
import { parseTouchLog, TOUCH_LOG_FORMAT, TouchLog } from './touch-log';

/** The browser's IndexedDB, where runs are stored, as their touch logs; missing in browsers without it. */
export const INDEXED_DB = new InjectionToken<IDBFactory | undefined>('INDEXED_DB', {
  factory: () => (typeof indexedDB === 'undefined' ? undefined : indexedDB),
});

/** The browser's storage manager, which can make the site's storage persistent; missing in older browsers. */
export const STORAGE_MANAGER = new InjectionToken<StorageManager | undefined>('STORAGE_MANAGER', {
  factory: () => (typeof navigator === 'undefined' ? undefined : navigator.storage),
});

/**
 * Whether this is a pull request preview rather than the main game: previews are served from `pr-<number>/` under the
 * main game.
 */
export const IS_PREVIEW = new InjectionToken<boolean>('IS_PREVIEW', {
  factory: () => isPreviewPath(new URL(inject(DOCUMENT).baseURI).pathname),
});

/** Whether the game served at this path, its base, is a pull request preview. */
export function isPreviewPath(path: string): boolean {
  return /\/pr-\d+\/$/.test(path);
}

export const DATABASE_NAME = 'slice-of-pi';
/**
 * The version of the database's layout (its object stores), not of the records in it: those carry their own format
 * (`TOUCH_LOG_FORMAT`). Pull request previews share the site's storage, so a newer layout must keep the stores older code
 * reads; older code then still opens the database at its newer version.
 */
export const DATABASE_VERSION = 3;
/** The touch log of each run, by id. */
export const RUNS = 'runs';
/** The player's settings, by name, each in its own format (such as `developer-mode.ts`). */
export const SETTINGS = 'settings';
/** Facts about the stored data, by key. */
export const META = 'meta';
/** Under {@link META}: the touch log format of the main game that last opened the database, as `{ format }`. */
export const MAIN_FORMAT = 'main-format';
/** Under {@link META}, in a preview's own database: set once the main game's settings were copied into it. */
export const COPIED_SETTINGS = 'copied-settings';

/** The database of previews whose touch log format isn't the main game's, kept apart from the main game's. */
export function previewDatabaseName(format: number): string {
  return `${DATABASE_NAME}-format-${String(format)}`;
}

/** The open database, whether this version of the game may write to it, and whether it's a preview's own. */
interface Database {
  readonly database: IDBDatabase;
  readonly writable: boolean;
  readonly separate: boolean;
}

/**
 * Keeps the player's runs, as their touch logs, and their settings, in IndexedDB, and asks the browser to keep that storage safe from eviction. Where IndexedDB
 * is missing or fails to open, nothing is stored and there are no runs.
 *
 * Pull request previews share the main game's storage. The main game notes its touch log format in
 * the database each time it opens it. A preview whose touch log format is the main game's (or which finds no runs from
 * the main game yet) uses the main game's database. Any other preview keeps its own database for its format, so it
 * never leaves records the main game can't load: each time it opens, it adds the main game's runs it doesn't have yet,
 * migrated, and the first time it also copies the main game's settings.
 */
@Service()
export class RunStore {
  private readonly indexedDb = inject(INDEXED_DB);
  private readonly storage = inject(STORAGE_MANAGER);
  private readonly preview = inject(IS_PREVIEW);
  private database: Promise<Database | undefined> | undefined;

  /** Saves a run's touch log, replacing the earlier save of the same run. */
  async save(log: TouchLog): Promise<void> {
    const database = await this.openForWriting();
    if (database === undefined) {
      return;
    }
    const transaction = database.transaction(RUNS, 'readwrite');
    transaction.objectStore(RUNS).put(log);
    await completion(transaction);
  }

  /** Deletes a run. */
  async delete(id: string): Promise<void> {
    const database = await this.openForWriting();
    if (database === undefined) {
      return;
    }
    const transaction = database.transaction(RUNS, 'readwrite');
    transaction.objectStore(RUNS).delete(id);
    await completion(transaction);
  }

  /** Deletes these runs. */
  async deleteRuns(ids: readonly string[]): Promise<void> {
    const database = await this.openForWriting();
    if (database === undefined) {
      return;
    }
    const transaction = database.transaction(RUNS, 'readwrite');
    for (const id of ids) {
      transaction.objectStore(RUNS).delete(id);
    }
    await completion(transaction);
  }

  /** Deletes every run, those in formats this version of the game doesn't know included. */
  async deleteAllRuns(): Promise<void> {
    const database = await this.openForWriting();
    if (database === undefined) {
      return;
    }
    const transaction = database.transaction(RUNS, 'readwrite');
    transaction.objectStore(RUNS).clear();
    await completion(transaction);
  }

  /**
   * Adds the touch logs of runs not stored yet, such as those of a backup, leaving the runs already stored as they are.
   */
  async addRuns(logs: readonly TouchLog[]): Promise<number> {
    const database = await this.openForWriting();
    if (database === undefined) {
      return 0;
    }
    const transaction = database.transaction(RUNS, 'readwrite');
    const store = transaction.objectStore(RUNS);
    const stored = new Set(await result(store.getAllKeys()));
    const added = logs.filter((log) => !stored.has(log.id));
    for (const log of added) {
      store.add(log);
    }
    await completion(transaction);
    return added.length;
  }

  /**
   * The touch log of every run stored in a format this version of the game knows, oldest first. Records in other formats
   * are left in the database, untouched.
   */
  async touchLogs(): Promise<TouchLog[]> {
    const database = (await this.open())?.database;
    if (database === undefined) {
      return [];
    }
    const records = await result(
      database.transaction(RUNS).objectStore(RUNS).getAll() as IDBRequest<unknown[]>,
    );
    return records
      .map(parseTouchLog)
      .filter((log) => log !== undefined)
      .sort((a, b) => a.startedAt - b.startedAt);
  }

  /** Every run stored, from its touch log (see {@link touchLogs}), oldest first. */
  async runs(): Promise<Run[]> {
    return (await this.touchLogs()).map(runOf);
  }

  /** A setting, as stored, or `undefined` where there is none. */
  async setting(name: string): Promise<unknown> {
    const database = (await this.open())?.database;
    if (database?.objectStoreNames.contains(SETTINGS) !== true) {
      return undefined;
    }
    return result(database.transaction(SETTINGS).objectStore(SETTINGS).get(name));
  }

  /**
   * Saves a setting. Settings follow the runs: they're only kept where the runs are, so a preview never leaves a
   * setting the main game can't read.
   */
  async saveSetting(name: string, value: unknown): Promise<void> {
    const database = await this.openForWriting();
    if (database === undefined) {
      return;
    }
    const transaction = database.transaction(SETTINGS, 'readwrite');
    transaction.objectStore(SETTINGS).put(value, name);
    await completion(transaction);
  }

  /** Every setting, as stored, by name. */
  async settings(): Promise<Record<string, unknown>> {
    const database = (await this.open())?.database;
    if (database?.objectStoreNames.contains(SETTINGS) !== true) {
      return {};
    }
    const store = database.transaction(SETTINGS).objectStore(SETTINGS);
    // Settings are only ever saved by name.
    const [names, values] = await Promise.all([
      result(store.getAllKeys() as IDBRequest<string[]>),
      result(store.getAll() as IDBRequest<unknown[]>),
    ]);
    return Object.fromEntries(names.map((name, i) => [name, values[i]]));
  }

  /** Saves these settings, such as those of a backup, replacing those stored under the same names. */
  async saveSettings(settings: Readonly<Record<string, unknown>>): Promise<void> {
    const database = await this.openForWriting();
    if (database === undefined) {
      return;
    }
    const transaction = database.transaction(SETTINGS, 'readwrite');
    for (const [name, value] of Object.entries(settings)) {
      transaction.objectStore(SETTINGS).put(value, name);
    }
    await completion(transaction);
  }

  /** Whether runs are kept: not where IndexedDB is missing. */
  async writable(): Promise<boolean> {
    return (await this.open())?.writable ?? false;
  }

  /** Whether this is a preview keeping its runs apart from the main game's, as its touch log format is another. */
  async separate(): Promise<boolean> {
    return (await this.open())?.separate ?? false;
  }

  /** Whether the browser keeps the site's storage until the player clears it, rather than when it runs low on space. */
  async persisted(): Promise<boolean> {
    return (await this.storage?.persisted()) ?? false;
  }

  /**
   * Asks the browser to keep the site's storage until the player clears it. Browsers decide on their own, some by
   * asking the player, so this is only asked once storage is actually used. Gives whether the storage is persistent.
   */
  async persist(): Promise<boolean> {
    if (this.storage === undefined) {
      return false;
    }
    return (await this.storage.persisted()) || this.storage.persist();
  }

  private open(): Promise<Database | undefined> {
    this.database ??= openDatabase(this.indexedDb, this.preview).catch((error: unknown) => {
      console.error('Could not open the database; runs will not be kept.', error);
      return undefined;
    });
    return this.database;
  }

  private async openForWriting(): Promise<IDBDatabase | undefined> {
    const opened = await this.open();
    return opened?.writable === true ? opened.database : undefined;
  }
}

async function openDatabase(
  indexedDb: IDBFactory | undefined,
  preview: boolean,
): Promise<Database | undefined> {
  if (indexedDb === undefined) {
    return undefined;
  }
  const database = await openLayout(indexedDb, DATABASE_NAME);
  if (!preview) {
    await migrateRuns(database);
    return { database, writable: true, separate: false };
  }
  // Until the main game has opened the database, it keeps no runs, so there are none to protect.
  const meta = database.transaction(META).objectStore(META);
  const main = (await result(meta.get(MAIN_FORMAT))) as { format?: unknown } | undefined;
  if (main === undefined || main.format === TOUCH_LOG_FORMAT) {
    return { database, writable: true, separate: false };
  }
  const own = await openLayout(indexedDb, previewDatabaseName(TOUCH_LOG_FORMAT));
  await copyFromMain(database, own);
  database.close();
  return { database: own, writable: true, separate: true };
}

/**
 * Adds to a preview's own database the main game's runs it doesn't have yet, migrated, and the first time the main
 * game's settings.
 */
async function copyFromMain(main: IDBDatabase, own: IDBDatabase): Promise<void> {
  // An older version of the game may have opened the main database at a newer layout, without settings.
  const settings = main.objectStoreNames.contains(SETTINGS);
  const from = main.transaction(settings ? [RUNS, SETTINGS] : [RUNS]);
  const [records, names, values] = await Promise.all([
    result(from.objectStore(RUNS).getAll() as IDBRequest<unknown[]>),
    settings ? result(from.objectStore(SETTINGS).getAllKeys()) : [],
    settings ? result(from.objectStore(SETTINGS).getAll() as IDBRequest<unknown[]>) : [],
  ]);
  const transaction = own.transaction([RUNS, SETTINGS, META], 'readwrite');
  const runs = transaction.objectStore(RUNS);
  const kept = new Set(await result(runs.getAllKeys()));
  for (const log of records.map(parseTouchLog)) {
    if (log !== undefined && !kept.has(log.id)) {
      runs.add(log);
    }
  }
  const meta = transaction.objectStore(META);
  if ((await result(meta.get(COPIED_SETTINGS))) === undefined) {
    names.forEach((name, i) => transaction.objectStore(SETTINGS).put(values[i], name));
    meta.put(true, COPIED_SETTINGS);
  }
  await completion(transaction);
}

/**
 * Brings the runs stored in older formats, touch logs or the runs before them, to the current touch log format, and
 * notes it as the main game's format, all at once. Only the main game does: previews never write runs the main game
 * couldn't load.
 */
async function migrateRuns(database: IDBDatabase): Promise<void> {
  const transaction = database.transaction([META, RUNS], 'readwrite');
  transaction.objectStore(META).put({ format: TOUCH_LOG_FORMAT }, MAIN_FORMAT);
  const runs = transaction.objectStore(RUNS);
  const records = await result(runs.getAll() as IDBRequest<unknown[]>);
  for (const record of records.filter((record) => isOlderFormat(record, TOUCH_LOG_FORMAT))) {
    const log = parseTouchLog(record);
    if (log !== undefined) {
      runs.put(log);
    }
  }
  await completion(transaction);
}

async function openLayout(indexedDb: IDBFactory, name: string): Promise<IDBDatabase> {
  try {
    const request = indexedDb.open(name, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(RUNS)) {
        request.result.createObjectStore(RUNS, { keyPath: 'id' });
      }
      for (const store of [META, SETTINGS]) {
        if (!request.result.objectStoreNames.contains(store)) {
          request.result.createObjectStore(store);
        }
      }
    };
    return await result(request);
  } catch (error) {
    // A newer version of the game (a pull request preview) upgraded the database: open it as it is.
    if (error instanceof DOMException && error.name === 'VersionError') {
      return result(indexedDb.open(name));
    }
    throw error;
  }
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request failed'));
    };
  });
}

function completion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = transaction.onabort = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    };
  });
}
