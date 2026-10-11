import { DOCUMENT } from '@angular/common';
import { inject, InjectionToken, Service } from '@angular/core';
import { isOlderFormat, parseRun, Run, RUN_FORMAT } from './run';

/** The browser's IndexedDB, where runs are stored; missing in browsers without it. */
export const INDEXED_DB = new InjectionToken<IDBFactory | undefined>('INDEXED_DB', {
  factory: () => (typeof indexedDB === 'undefined' ? undefined : indexedDB),
});

/** The browser's storage manager, which can make the site's storage persistent; missing in older browsers. */
export const STORAGE_MANAGER = new InjectionToken<StorageManager | undefined>('STORAGE_MANAGER', {
  factory: () => (typeof navigator === 'undefined' ? undefined : navigator.storage),
});

/**
 * Whether this is a pull request preview rather than the main game: previews are served from `pr-<number>/` under the
 * main game (`architecture.md` §1).
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
 * (`RUN_FORMAT`). Pull request previews share the site's storage, so a newer layout must keep the stores older code
 * reads; older code then still opens the database at its newer version.
 */
export const DATABASE_VERSION = 3;
export const RUNS = 'runs';
/** The player's settings, by name, each in its own format (such as `developer-mode.ts`). */
export const SETTINGS = 'settings';
/** Facts about the stored data, by key. */
export const META = 'meta';
/** Under {@link META}: the run format of the main game that last opened the database, as `{ format }`. */
export const MAIN_FORMAT = 'main-format';

/** The open database, and whether this version of the game may write to it. */
interface Database {
  readonly database: IDBDatabase;
  readonly writable: boolean;
}

/**
 * Keeps the player's runs, and their settings, in IndexedDB, and asks the browser to keep that storage safe from eviction. Where IndexedDB
 * is missing or fails to open, nothing is stored and there are no runs.
 *
 * Pull request previews share the main game's storage (`architecture.md` §5). The main game notes its run format in
 * the database each time it opens it. A preview reads the runs it finds, but only writes when its run format is the
 * main game's (or the main game hasn't kept any runs yet), so it never leaves records the main game can't load.
 */
@Service()
export class RunStore {
  private readonly indexedDb = inject(INDEXED_DB);
  private readonly storage = inject(STORAGE_MANAGER);
  private readonly preview = inject(IS_PREVIEW);
  private database: Promise<Database | undefined> | undefined;

  /** Saves a run, replacing the earlier save of the same run. */
  async save(run: Run): Promise<void> {
    const database = await this.openForWriting();
    if (database === undefined) {
      return;
    }
    const transaction = database.transaction(RUNS, 'readwrite');
    transaction.objectStore(RUNS).put(run);
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

  /** Adds the runs not stored yet, such as those of a backup, leaving the runs already stored as they are. */
  async addRuns(runs: readonly Run[]): Promise<number> {
    const database = await this.openForWriting();
    if (database === undefined) {
      return 0;
    }
    const transaction = database.transaction(RUNS, 'readwrite');
    const store = transaction.objectStore(RUNS);
    const stored = new Set(await result(store.getAllKeys()));
    const added = runs.filter((run) => !stored.has(run.id));
    for (const run of added) {
      store.add(run);
    }
    await completion(transaction);
    return added.length;
  }

  /**
   * Every run stored in a format this version of the game knows, oldest first. Records in other formats are left in
   * the database, untouched.
   */
  async runs(): Promise<Run[]> {
    const database = (await this.open())?.database;
    if (database === undefined) {
      return [];
    }
    const records = await result(
      database.transaction(RUNS).objectStore(RUNS).getAll() as IDBRequest<unknown[]>,
    );
    return records
      .map(parseRun)
      .filter((run) => run !== undefined)
      .sort((a, b) => a.startedAt - b.startedAt);
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

  /** Whether runs are kept: not where IndexedDB is missing, nor in a preview whose run format isn't the main game's. */
  async writable(): Promise<boolean> {
    return (await this.open())?.writable ?? false;
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
  const database = await openLayout(indexedDb);
  if (database === undefined) {
    return undefined;
  }
  if (!preview) {
    await migrateRuns(database);
    return { database, writable: true };
  }
  // Until the main game has opened the database, it keeps no runs, so there are none to protect.
  const meta = database.transaction(META).objectStore(META);
  const main = (await result(meta.get(MAIN_FORMAT))) as { format?: unknown } | undefined;
  return { database, writable: main === undefined || main.format === RUN_FORMAT };
}

/**
 * Brings the runs stored in older formats to the current one, and notes it as the main game's run format, all at once.
 * Only the main game does: previews never write runs the main game couldn't load.
 */
async function migrateRuns(database: IDBDatabase): Promise<void> {
  const transaction = database.transaction([META, RUNS], 'readwrite');
  transaction.objectStore(META).put({ format: RUN_FORMAT }, MAIN_FORMAT);
  const runs = transaction.objectStore(RUNS);
  const records = await result(runs.getAll() as IDBRequest<unknown[]>);
  for (const record of records.filter(isOlderFormat)) {
    const run = parseRun(record);
    if (run !== undefined) {
      runs.put(run);
    }
  }
  await completion(transaction);
}

async function openLayout(indexedDb: IDBFactory | undefined): Promise<IDBDatabase | undefined> {
  if (indexedDb === undefined) {
    return undefined;
  }
  try {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
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
      return result(indexedDb.open(DATABASE_NAME));
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
