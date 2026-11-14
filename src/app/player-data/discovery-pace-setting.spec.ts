import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { INDEXED_DB, IS_PREVIEW, RunStore } from './run-store';
import {
  DISCOVERY_PACE,
  DISCOVERY_PACE_FORMAT,
  DiscoveryPaceSetting,
} from './discovery-pace-setting';

describe('DiscoveryPaceSetting', () => {
  let indexedDb: IDBFactory;

  beforeEach(() => {
    indexedDb = new IDBFactory();
  });

  async function load(): Promise<DiscoveryPaceSetting> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: IS_PREVIEW, useValue: false },
        { provide: INDEXED_DB, useValue: indexedDb },
      ],
    });
    const setting = TestBed.inject(DiscoveryPaceSetting);
    await setting.loaded;
    return setting;
  }

  it('is the medium pace at first, and keeps the pace picked for the next visits', async () => {
    expect((await load()).pace()).toBe('medium');

    await (await load()).set('faster');

    expect((await load()).pace()).toBe('faster');
  });

  it('is the medium pace when the setting is in a format it does not know, or names no pace', async () => {
    await load();
    await TestBed.inject(RunStore).saveSetting(DISCOVERY_PACE, {
      format: DISCOVERY_PACE_FORMAT + 1,
      pace: 'slower',
    });
    expect((await load()).pace()).toBe('medium');

    await TestBed.inject(RunStore).saveSetting(DISCOVERY_PACE, {
      format: DISCOVERY_PACE_FORMAT,
      pace: 'sluggish',
    });
    expect((await load()).pace()).toBe('medium');
  });

  it('reads the setting again once something else changed it', async () => {
    const setting = await load();
    await TestBed.inject(RunStore).saveSetting(DISCOVERY_PACE, {
      format: DISCOVERY_PACE_FORMAT,
      pace: 'slower',
    });

    await setting.reload();

    expect(setting.pace()).toBe('slower');
  });
});
