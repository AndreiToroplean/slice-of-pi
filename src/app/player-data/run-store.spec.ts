import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { runOf } from './run';
import { newTouchLog, TOUCH_LOG_FORMAT } from './touch-log';
import { typeKey } from '../../testing/touch-logs';
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  INDEXED_DB,
  IS_PREVIEW,
  isPreviewPath,
  MAIN_FORMAT,
  META,
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
    providers: {
      indexedDb?: IDBFactory | undefined;
      storage?: StorageManager | undefined;
      preview?: boolean;
    } = {},
  ): RunStore {
    TestBed.configureTestingModule({
      providers: [
        { provide: IS_PREVIEW, useValue: providers.preview ?? false },
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

  /** Every record in the runs store, as stored. */
  async function storedRecords(): Promise<unknown[]> {
    const database = await openDirectly();
    const records = await new Promise<unknown[]>((resolve) => {
      const request = database.transaction(RUNS).objectStore(RUNS).getAll();
      request.onsuccess = () => {
        resolve(request.result);
      };
    });
    database.close();
    return records;
  }

  const first = typeKey(typeKey(newTouchLog('a', 1_000), '1', 0), '4', 250);
  const second = typeKey(newTouchLog('b', 2_000), '1', 0);
  /** A run as the game stored it before it checked digits, in format 1. */
  const unchecked = {
    format: 1,
    id: 'old',
    startedAt: 500,
    digits: '7',
    times: [0],
    backspaces: [],
  };

  it('has no runs at first', async () => {
    expect(await storeWith().touchLogs()).toEqual([]);
  });

  it('gives the run of each touch log', async () => {
    const store = storeWith();

    await store.save(first);

    expect(await store.runs()).toEqual([runOf(first)]);
  });

  it('keeps the runs saved, oldest first', async () => {
    const store = storeWith();

    await store.save(second);
    await store.save(first);

    expect(await store.touchLogs()).toEqual([first, second]);
  });

  it('replaces an earlier save of the same run', async () => {
    const store = storeWith();

    await store.save(first);
    const longer = typeKey(first, '1', 600);
    await store.save(longer);

    expect(await store.touchLogs()).toEqual([longer]);
  });

  it('deletes a run', async () => {
    const store = storeWith();
    await store.save(first);
    await store.save(second);

    await store.delete(first.id);

    expect(await store.touchLogs()).toEqual([second]);
  });

  it('deletes several runs at once', async () => {
    const store = storeWith();
    await store.save(first);
    await store.save(second);

    await store.deleteRuns([first.id, 'missing']);

    expect(await store.touchLogs()).toEqual([second]);
  });

  it('deletes every run, even those it cannot read', async () => {
    const store = storeWith();
    await store.save(first);
    const database = await openDirectly();
    await put(database, [{ ...second, format: TOUCH_LOG_FORMAT + 1 }]);
    database.close();

    await store.deleteAllRuns();

    expect(await storedRecords()).toEqual([]);
  });

  it('deletes every run and every setting, to start over', async () => {
    const store = storeWith();
    await store.save(first);
    await store.saveSetting('a setting', { value: 1 });

    await store.deleteEverything();

    expect(await storedRecords()).toEqual([]);
    expect(await store.settings()).toEqual({});
  });

  it('keeps the runs for the next visit', async () => {
    await storeWith().save(first);
    TestBed.resetTestingModule();

    expect(await storeWith().touchLogs()).toEqual([first]);
  });

  it('skips records it cannot read, and leaves them in the database', async () => {
    const store = storeWith();
    await store.save(first);
    const database = await openDirectly();
    const future = { ...second, format: TOUCH_LOG_FORMAT + 1, rhythm: [] };
    await put(database, [future, { id: 'broken' }]);
    database.close();

    expect(await store.touchLogs()).toEqual([first]);
    const after = await openDirectly();
    const count = await new Promise<number>((resolve) => {
      const request = after.transaction(RUNS).objectStore(RUNS).count();
      request.onsuccess = () => {
        resolve(request.result);
      };
    });
    expect(count).toBe(3);
  });

  it('migrates the runs stored in older formats, and stores them in the current one', async () => {
    await storeWith().writable();
    TestBed.resetTestingModule();
    const database = await openDirectly();
    await put(database, [unchecked]);
    database.close();

    const migrated = {
      format: TOUCH_LOG_FORMAT,
      id: 'old',
      startedAt: 500,
      checked: false,
      keypadLayout: 'calculator',
      touches: [{ key: '7', time: 0 }],
    };
    expect(await storeWith().touchLogs()).toEqual([migrated]);
    expect(await storedRecords()).toEqual([migrated]);
  });

  it('opens a database a newer version of the game upgraded', async () => {
    const database = await openDirectly(DATABASE_VERSION + 1, (upgraded) => {
      upgraded.createObjectStore(RUNS, { keyPath: 'id' });
      upgraded.createObjectStore(META);
      upgraded.createObjectStore('future');
    });
    await put(database, [first]);
    database.close();

    const store = storeWith();
    await store.save(second);

    expect(await store.touchLogs()).toEqual([first, second]);
  });

  it('adds the runs not stored yet, leaving the stored ones as they are', async () => {
    const store = storeWith();
    await store.save(first);

    const changed = typeKey(first, '1', 400);
    expect(await store.addRuns([changed, second])).toBe(1);
    expect(await store.addRuns([second])).toBe(0);
    expect(await store.touchLogs()).toEqual([first, second]);
  });

  it('keeps nothing without IndexedDB', async () => {
    const store = storeWith({ indexedDb: undefined });

    await store.save(first);
    await store.delete(first.id);

    expect(await store.addRuns([first])).toBe(0);
    expect(await store.touchLogs()).toEqual([]);
  });

  it('keeps nothing when the database fails to open', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(indexedDb, 'open').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const store = storeWith();

    await store.save(first);

    expect(await store.touchLogs()).toEqual([]);
    expect(error).toHaveBeenCalledOnce();
  });

  it('opens a database of an older layout, adding the stores it lacks', async () => {
    const database = await openDirectly(1, (created) => {
      created.createObjectStore(RUNS, { keyPath: 'id' });
    });
    await put(database, [first]);
    database.close();

    const store = storeWith();
    await store.save(second);

    expect(await store.touchLogs()).toEqual([first, second]);
  });

  describe('settings', () => {
    it('keeps settings by name, for the next visit', async () => {
      const store = storeWith();
      expect(await store.setting('colors')).toBeUndefined();

      await store.saveSetting('colors', { format: 1, red: '#ff0000' });
      await store.saveSetting('colors', { format: 1, red: '#ee0000' });
      TestBed.resetTestingModule();

      expect(await storeWith().setting('colors')).toEqual({ format: 1, red: '#ee0000' });
    });

    it('gives every setting, and saves several at once, replacing those of the same name', async () => {
      const store = storeWith();
      expect(await store.settings()).toEqual({});
      await store.saveSetting('colors', { format: 1, red: '#ff0000' });
      await store.saveSetting('sounds', { format: 1, on: true });

      await store.saveSettings({ colors: { format: 1, red: '#ee0000' }, mode: 'dark' });

      expect(await store.settings()).toEqual({
        colors: { format: 1, red: '#ee0000' },
        mode: 'dark',
        sounds: { format: 1, on: true },
      });
    });

    it('keeps none without IndexedDB', async () => {
      const store = storeWith({ indexedDb: undefined });

      await store.saveSetting('colors', 1);
      await store.saveSettings({ sounds: 1 });

      expect(await store.setting('colors')).toBeUndefined();
      expect(await store.settings()).toEqual({});
    });

    it('has none in a database an older version of the game opened at a newer layout', async () => {
      const database = await openDirectly(DATABASE_VERSION + 1, (upgraded) => {
        upgraded.createObjectStore(RUNS, { keyPath: 'id' });
        upgraded.createObjectStore(META);
      });
      database.close();

      const store = storeWith();
      expect(await store.setting('colors')).toBeUndefined();
      expect(await store.settings()).toEqual({});
    });
  });

  describe('in a pull request preview', () => {
    /** Reads what the main game noted about its run format. */
    async function mainFormat(): Promise<unknown> {
      const database = await openDirectly();
      const value = await new Promise((resolve) => {
        const request = database.transaction(META).objectStore(META).get(MAIN_FORMAT);
        request.onsuccess = () => {
          resolve(request.result);
        };
      });
      database.close();
      return value;
    }

    async function noteMainFormat(format: number): Promise<void> {
      const database = await openDirectly();
      await new Promise<void>((resolve) => {
        const transaction = database.transaction(META, 'readwrite');
        transaction.objectStore(META).put({ format }, MAIN_FORMAT);
        transaction.oncomplete = () => {
          resolve();
        };
      });
      database.close();
    }

    it('lets the main game note its run format', async () => {
      const store = storeWith();

      expect(await store.writable()).toBe(true);
      expect(await mainFormat()).toEqual({ format: TOUCH_LOG_FORMAT });
    });

    it("uses the main game's runs, and keeps runs, when its run format is the main game's", async () => {
      await storeWith().save(first);
      TestBed.resetTestingModule();
      const preview = storeWith({ preview: true });

      await preview.save(second);

      expect(await preview.writable()).toBe(true);
      expect(await preview.touchLogs()).toEqual([first, second]);
    });

    it("keeps its runs apart, from a copy of the main game's, when its run format is not the main game's", async () => {
      const main = storeWith();
      await main.save(first);
      await main.saveSetting('colors', 1);
      TestBed.resetTestingModule();
      await noteMainFormat(TOUCH_LOG_FORMAT - 1);
      const preview = storeWith({ preview: true });

      await preview.save(second);
      await preview.delete(first.id);
      await preview.saveSetting('sounds', 1);

      expect(await preview.writable()).toBe(true);
      expect(await preview.separate()).toBe(true);
      expect(await preview.touchLogs()).toEqual([second]);
      expect(await preview.settings()).toEqual({ colors: 1, sounds: 1 });
      expect(await storedRecords()).toEqual([first]);
      expect(await mainFormat()).toEqual({ format: TOUCH_LOG_FORMAT - 1 });
    });

    it("adds the main game's new runs each time it opens, but copies its settings only once", async () => {
      const main = storeWith();
      await main.saveSetting('colors', 1);
      TestBed.resetTestingModule();
      await noteMainFormat(TOUCH_LOG_FORMAT - 1);
      await storeWith({ preview: true }).saveSetting('colors', 2);
      TestBed.resetTestingModule();
      const database = await openDirectly();
      await put(database, [first]);
      database.close();

      const preview = storeWith({ preview: true });

      expect(await preview.touchLogs()).toEqual([first]);
      expect(await preview.settings()).toEqual({ colors: 2 });
    });

    it('migrates the runs of an older main game into its own database, leaving them stored as they are', async () => {
      await storeWith().writable();
      TestBed.resetTestingModule();
      const database = await openDirectly();
      await put(database, [unchecked]);
      database.close();
      await noteMainFormat(TOUCH_LOG_FORMAT - 1);

      const preview = storeWith({ preview: true });

      expect(await preview.touchLogs()).toEqual([
        {
          format: TOUCH_LOG_FORMAT,
          id: 'old',
          startedAt: 500,
          checked: false,
          keypadLayout: 'calculator',
          touches: [{ key: '7', time: 0 }],
        },
      ]);
      expect(await storedRecords()).toEqual([unchecked]);
    });

    it("uses the main database, and is not apart, when its run format is the main game's", async () => {
      await storeWith().writable();
      TestBed.resetTestingModule();

      expect(await storeWith({ preview: true }).separate()).toBe(false);
    });

    it('keeps runs when the main game has never opened the database', async () => {
      const preview = storeWith({ preview: true });

      await preview.save(first);

      expect(await preview.writable()).toBe(true);
      expect(await preview.touchLogs()).toEqual([first]);
      expect(await mainFormat()).toBeUndefined();
    });

    it('is told apart from the main game by its path', () => {
      expect(isPreviewPath('/slice-of-pi/pr-13/')).toBe(true);
      expect(isPreviewPath('/slice-of-pi/')).toBe(false);
      expect(isPreviewPath('/')).toBe(false);
      expect(isPreviewPath('/slice-of-pi/pr-13/play')).toBe(false);
    });
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
