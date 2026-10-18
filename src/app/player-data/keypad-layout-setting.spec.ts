import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { INDEXED_DB, IS_PREVIEW, RunStore } from './run-store';
import { KEYPAD_LAYOUT, KEYPAD_LAYOUT_FORMAT, KeypadLayoutSetting } from './keypad-layout-setting';

describe('KeypadLayoutSetting', () => {
  let indexedDb: IDBFactory;

  beforeEach(() => {
    indexedDb = new IDBFactory();
  });

  async function load(): Promise<KeypadLayoutSetting> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: IS_PREVIEW, useValue: false },
        { provide: INDEXED_DB, useValue: indexedDb },
      ],
    });
    const setting = TestBed.inject(KeypadLayoutSetting);
    await setting.loaded;
    return setting;
  }

  it('is the calculator layout at first', async () => {
    expect((await load()).layout()).toBe('calculator');
  });

  it('keeps the layout picked for the next visits', async () => {
    await (await load()).set('telephone');
    const next = await load();
    expect(next.layout()).toBe('telephone');

    await next.set('calculator');
    expect((await load()).layout()).toBe('calculator');
  });

  it('is the calculator layout when the setting is in a format it does not know, or names no layout', async () => {
    await load();
    await TestBed.inject(RunStore).saveSetting(KEYPAD_LAYOUT, {
      format: KEYPAD_LAYOUT_FORMAT + 1,
      layout: 'telephone',
    });
    expect((await load()).layout()).toBe('calculator');

    await TestBed.inject(RunStore).saveSetting(KEYPAD_LAYOUT, {
      format: KEYPAD_LAYOUT_FORMAT,
      layout: 'typewriter',
    });
    expect((await load()).layout()).toBe('calculator');
  });

  it('reads the setting again once something else changed it', async () => {
    const setting = await load();
    await TestBed.inject(RunStore).saveSetting(KEYPAD_LAYOUT, {
      format: KEYPAD_LAYOUT_FORMAT,
      layout: 'telephone',
    });

    await setting.reload();

    expect(setting.layout()).toBe('telephone');
  });
});
