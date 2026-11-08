import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { INDEXED_DB, IS_PREVIEW, RunStore } from './run-store';
import { GROUP_SIZE, GROUP_SIZE_FORMAT, GroupSizeSetting } from './group-size-setting';

describe('GroupSizeSetting', () => {
  let indexedDb: IDBFactory;

  beforeEach(() => {
    indexedDb = new IDBFactory();
  });

  async function load(): Promise<GroupSizeSetting> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: IS_PREVIEW, useValue: false },
        { provide: INDEXED_DB, useValue: indexedDb },
      ],
    });
    const setting = TestBed.inject(GroupSizeSetting);
    await setting.loaded;
    return setting;
  }

  it('is 5 at first, and keeps the size picked for the next visits', async () => {
    expect((await load()).size()).toBe(5);

    await (await load()).set(7);

    expect((await load()).size()).toBe(7);
  });

  it.each([2, 11, 4.5, '6'])('is 5 when the stored size is %j, out of range', async (size) => {
    await load();
    await TestBed.inject(RunStore).saveSetting(GROUP_SIZE, { format: GROUP_SIZE_FORMAT, size });

    expect((await load()).size()).toBe(5);
  });

  it('is 5 when the setting is in a format it does not know', async () => {
    await load();
    await TestBed.inject(RunStore).saveSetting(GROUP_SIZE, {
      format: GROUP_SIZE_FORMAT + 1,
      size: 7,
    });

    expect((await load()).size()).toBe(5);
  });
});
