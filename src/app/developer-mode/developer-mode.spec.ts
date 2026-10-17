import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { INDEXED_DB, IS_PREVIEW, RunStore } from '../player-data/run-store';
import { DEVELOPER_MODE, DEVELOPER_MODE_FORMAT, DeveloperMode } from './developer-mode';

describe('DeveloperMode', () => {
  let indexedDb: IDBFactory;

  beforeEach(() => {
    indexedDb = new IDBFactory();
  });

  async function load(): Promise<DeveloperMode> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: IS_PREVIEW, useValue: false },
        { provide: INDEXED_DB, useValue: indexedDb },
      ],
    });
    const developerMode = TestBed.inject(DeveloperMode);
    await developerMode.loaded;
    return developerMode;
  }

  it('is off at first', async () => {
    expect((await load()).enabled()).toBe(false);
  });

  it('stays on, then off, for the next visits', async () => {
    await (await load()).set(true);
    const next = await load();
    expect(next.enabled()).toBe(true);

    await next.set(false);
    expect((await load()).enabled()).toBe(false);
  });

  it('is off when the setting is in a format it does not know', async () => {
    const developerMode = await load();
    await TestBed.inject(RunStore).saveSetting(DEVELOPER_MODE, {
      format: DEVELOPER_MODE_FORMAT + 1,
      enabled: true,
    });
    expect(developerMode.enabled()).toBe(false);

    expect((await load()).enabled()).toBe(false);
  });

  it('reads a setting without a format as one of format 1', async () => {
    await load();
    await TestBed.inject(RunStore).saveSetting(DEVELOPER_MODE, { enabled: true });

    expect((await load()).enabled()).toBe(true);
  });

  it('reads the setting again once something else changed it', async () => {
    const developerMode = await load();
    await TestBed.inject(RunStore).saveSetting(DEVELOPER_MODE, {
      format: DEVELOPER_MODE_FORMAT,
      enabled: true,
    });

    await developerMode.reload();

    expect(developerMode.enabled()).toBe(true);
  });

  it('keeps a change made before the setting was read', async () => {
    await (await load()).set(true);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: INDEXED_DB, useValue: indexedDb }] });
    const developerMode = TestBed.inject(DeveloperMode);

    await developerMode.set(false);
    await developerMode.loaded;

    expect(developerMode.enabled()).toBe(false);
  });
});
