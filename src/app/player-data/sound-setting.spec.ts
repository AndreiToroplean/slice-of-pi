import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { INDEXED_DB, IS_PREVIEW, RunStore } from './run-store';
import { SOUND, SOUND_FORMAT, SoundSetting } from './sound-setting';

describe('SoundSetting', () => {
  let indexedDb: IDBFactory;

  beforeEach(() => {
    indexedDb = new IDBFactory();
  });

  async function load(): Promise<SoundSetting> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: IS_PREVIEW, useValue: false },
        { provide: INDEXED_DB, useValue: indexedDb },
      ],
    });
    const setting = TestBed.inject(SoundSetting);
    await setting.loaded;
    return setting;
  }

  it('is on at first', async () => {
    expect((await load()).enabled()).toBe(true);
  });

  it('keeps sounds off or on for the next visits', async () => {
    await (await load()).set(false);
    const next = await load();
    expect(next.enabled()).toBe(false);

    await next.set(true);
    expect((await load()).enabled()).toBe(true);
  });

  it('is on when the setting is in a format it does not know', async () => {
    await load();
    await TestBed.inject(RunStore).saveSetting(SOUND, {
      format: SOUND_FORMAT + 1,
      enabled: false,
    });
    expect((await load()).enabled()).toBe(true);
  });

  it('reads the setting again once something else changed it', async () => {
    const setting = await load();
    await TestBed.inject(RunStore).saveSetting(SOUND, {
      format: SOUND_FORMAT,
      enabled: false,
    });

    await setting.reload();

    expect(setting.enabled()).toBe(false);
  });
});
