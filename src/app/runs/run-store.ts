import { inject, InjectionToken, Service } from '@angular/core';
import { parseRun, Run } from './run';

/** The browser's IndexedDB, where runs are stored; missing in browsers without it. */
export const INDEXED_DB = new InjectionToken<IDBFactory | undefined>('INDEXED_DB', {
  factory: () => (typeof indexedDB === 'undefined' ? undefined : indexedDB),
});

/** The browser's storage manager, which can make the site's storage persistent; missing in older browsers. */
export const STORAGE_MANAGER = new InjectionToken<StorageManager | undefined>('STORAGE_MANAGER', {
  factory: () => (typeof navigator === 'undefined' ? undefined : navigator.storage),
});

export const DATABASE_NAME = 'slice-of-pi';
/**
 * The version of the database's layout (its object stores), not of the records in it: those carry their own format
 * (`RUN_FORMAT`). Pull request previews share the site's storage, so a newer layout must keep the stores older code
 * reads; older code then still opens the database at its newer version.
 */
export const DATABASE_VERSION = 1;
export const RUNS = 'runs';

/**
 * Keeps the player's runs in IndexedDB, and asks the browser to keep that storage safe from eviction. Where IndexedDB
 * is missing or fails to open, nothing is stored and there are no runs.
 */
@Service()
export class RunStore {
  private readonly indexedDb = inject(INDEXED_DB);
  private readonly storage = inject(STORAGE_MANAGER);
  private database: Promise<IDBDatabase | undefined> | undefined;

  /** Saves a run, replacing the earlier save of the same run. */
  async save(run: Run): Promise<void> {
    const database = await this.open();
    if (database === undefined) {
      return;
    }
    const transaction = database.transaction(RUNS, 'readwrite');
    transaction.objectStore(RUNS).put(run);
    await completion(transaction);
  }

  /** Deletes a run. */
  async delete(id: string): Promise<void> {
    const database = await this.open();
    if (database === undefined) {
      return;
    }
    const transaction = database.transaction(RUNS, 'readwrite');
    transaction.objectStore(RUNS).delete(id);
    await completion(transaction);
  }

  /** Adds the runs not stored yet, such as those of a backup, leaving the runs already stored as they are. */
  async addRuns(runs: readonly Run[]): Promise<number> {
    const database = await this.open();
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
    const database = await this.open();
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

  private open(): Promise<IDBDatabase | undefined> {
    this.database ??= openDatabase(this.indexedDb).catch((error: unknown) => {
      console.error('Could not open the database; runs will not be kept.', error);
      return undefined;
    });
    return this.database;
  }
}

async function openDatabase(indexedDb: IDBFactory | undefined): Promise<IDBDatabase | undefined> {
  if (indexedDb === undefined) {
    return undefined;
  }
  try {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(RUNS)) {
        request.result.createObjectStore(RUNS, { keyPath: 'id' });
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
