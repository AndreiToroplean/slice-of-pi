import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { addKey, newRun, RUN_FORMAT } from './run';
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  INDEXED_DB,
  RunStore,
  RUNS,
  STORAGE_MANAGER,
} from './run-store';

describe('RunStore', () => {
  let indexedDb: IDBFactory;

  beforeEach(() => {
    indexedDb = new IDBFactory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function storeWith(
    providers: { indexedDb?: IDBFactory | undefined; storage?: StorageManager | undefined } = {},
  ): RunStore {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: INDEXED_DB,
          useValue: 'indexedDb' in providers ? providers.indexedDb : indexedDb,
        },
        { provide: STORAGE_MANAGER, useValue: providers.storage },
      ],
    });
    return TestBed.inject(RunStore);
  }

  /** Opens the database as another tab, or another version of the game, would. */
  function openDirectly(
    version?: number,
    upgrade?: (database: IDBDatabase) => void,
  ): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDb.open(DATABASE_NAME, version);
      request.onupgradeneeded = () => upgrade?.(request.result);
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(new Error('open failed'));
      };
    });
  }

  function put(database: IDBDatabase, records: unknown[]): Promise<void> {
    return new Promise((resolve) => {
      const transaction = database.transaction(RUNS, 'readwrite');
      for (const record of records) {
        transaction.objectStore(RUNS).put(record);
      }
      transaction.oncomplete = () => {
        resolve();
      };
    });
  }

  const first = addKey(addKey(newRun('a', 1_000), '1', 0), '4', 250);
  const second = addKey(newRun('b', 2_000), '1', 0);

  it('has no runs at first', async () => {
    expect(await storeWith().runs()).toEqual([]);
  });

  it('keeps the runs saved, oldest first', async () => {
    const store = storeWith();

    await store.save(second);
    await store.save(first);

    expect(await store.runs()).toEqual([first, second]);
  });

  it('replaces an earlier save of the same run', async () => {
    const store = storeWith();

    await store.save(first);
    const longer = addKey(first, 'backspace', 600);
    await store.save(longer);

    expect(await store.runs()).toEqual([longer]);
  });

  it('keeps the runs for the next visit', async () => {
    await storeWith().save(first);
    TestBed.resetTestingModule();

    expect(await storeWith().runs()).toEqual([first]);
  });

  it('skips records it cannot read, and leaves them in the database', async () => {
    const store = storeWith();
    await store.save(first);
    const database = await openDirectly();
    const future = { ...second, format: RUN_FORMAT + 1, rhythm: [] };
    await put(database, [future, { id: 'broken' }]);
    database.close();

    expect(await store.runs()).toEqual([first]);
    const after = await openDirectly();
    const count = await new Promise<number>((resolve) => {
      const request = after.transaction(RUNS).objectStore(RUNS).count();
      request.onsuccess = () => {
        resolve(request.result);
      };
    });
    expect(count).toBe(3);
  });

  it('opens a database a newer version of the game upgraded', async () => {
    const database = await openDirectly(DATABASE_VERSION + 1, (upgraded) => {
      upgraded.createObjectStore(RUNS, { keyPath: 'id' });
      upgraded.createObjectStore('future');
    });
    await put(database, [first]);
    database.close();

    const store = storeWith();
    await store.save(second);

    expect(await store.runs()).toEqual([first, second]);
  });

  it('adds the runs not stored yet, leaving the stored ones as they are', async () => {
    const store = storeWith();
    await store.save(first);

    const changed = addKey(first, '1', 400);
    expect(await store.addRuns([changed, second])).toBe(1);
    expect(await store.addRuns([second])).toBe(0);
    expect(await store.runs()).toEqual([first, second]);
  });

  it('keeps nothing without IndexedDB', async () => {
    const store = storeWith({ indexedDb: undefined });

    await store.save(first);

    expect(await store.addRuns([first])).toBe(0);
    expect(await store.runs()).toEqual([]);
  });

  it('keeps nothing when the database fails to open', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(indexedDb, 'open').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const store = storeWith();

    await store.save(first);

    expect(await store.runs()).toEqual([]);
    expect(error).toHaveBeenCalledOnce();
  });

  describe('persistent storage', () => {
    const persist = vi.fn<() => Promise<boolean>>();

    function storageManager(persisted: boolean, granted: boolean): StorageManager {
      persist.mockReset().mockResolvedValue(granted);
      return {
        persisted: () => Promise.resolve(persisted),
        persist,
      } as Partial<StorageManager> as StorageManager;
    }

    it('asks the browser to keep the storage', async () => {
      const store = storeWith({ storage: storageManager(false, true) });

      expect(await store.persist()).toBe(true);
      expect(persist).toHaveBeenCalledOnce();
    });

    it('gives whether the browser agreed', async () => {
      expect(await storeWith({ storage: storageManager(false, false) }).persist()).toBe(false);
    });

    it('does not ask again once the storage is persistent', async () => {
      const store = storeWith({ storage: storageManager(true, true) });

      expect(await store.persisted()).toBe(true);
      expect(await store.persist()).toBe(true);
      expect(persist).not.toHaveBeenCalled();
    });

    it('is not persistent where the browser cannot make it so', async () => {
      const store = storeWith({ storage: undefined });

      expect(await store.persisted()).toBe(false);
      expect(await store.persist()).toBe(false);
    });
  });
});
