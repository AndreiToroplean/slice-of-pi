import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { INDEXED_DB, IS_PREVIEW, RunStore } from './run-store';
import { VIBRATION, VIBRATION_FORMAT, VibrationSetting } from './vibration-setting';

describe('VibrationSetting', () => {
  let indexedDb: IDBFactory;

  beforeEach(() => {
    indexedDb = new IDBFactory();
  });

  async function load(): Promise<VibrationSetting> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: IS_PREVIEW, useValue: false },
        { provide: INDEXED_DB, useValue: indexedDb },
      ],
    });
    const setting = TestBed.inject(VibrationSetting);
    await setting.loaded;
    return setting;
  }

  it('is on at first', async () => {
    expect((await load()).enabled()).toBe(true);
  });

  it('keeps vibration off or on for the next visits', async () => {
    await (await load()).set(false);
    const next = await load();
    expect(next.enabled()).toBe(false);

    await next.set(true);
    expect((await load()).enabled()).toBe(true);
  });

  it('is on when the setting is in a format it does not know', async () => {
    await load();
    await TestBed.inject(RunStore).saveSetting(VIBRATION, {
      format: VIBRATION_FORMAT + 1,
      enabled: false,
    });
    expect((await load()).enabled()).toBe(true);
  });

  it('reads the setting again once something else changed it', async () => {
    const setting = await load();
    await TestBed.inject(RunStore).saveSetting(VIBRATION, {
      format: VIBRATION_FORMAT,
      enabled: false,
    });

    await setting.reload();

    expect(setting.enabled()).toBe(false);
  });
});
