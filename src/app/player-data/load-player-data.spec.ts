import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { typeKey } from '../../testing/touch-logs';
import { DeveloperMode } from '../developer-mode/developer-mode';
import { DiscoveryPaceSetting } from './discovery-pace-setting';
import { KeypadLayoutSetting } from './keypad-layout-setting';
import { loadPlayerData } from './load-player-data';
import { INDEXED_DB, RunStore } from './run-store';
import { newTouchLog } from './touch-log';

describe('loadPlayerData', () => {
  it('has the runs and settings stored once done, as the app opens', async () => {
    const indexedDb = new IDBFactory();
    TestBed.configureTestingModule({ providers: [{ provide: INDEXED_DB, useValue: indexedDb }] });
    const run = typeKey(newTouchLog('a', 0), '1', 0);
    await TestBed.inject(RunStore).save(run);
    await TestBed.inject(KeypadLayoutSetting).set('telephone');
    await TestBed.inject(DiscoveryPaceSetting).set('faster');
    await TestBed.inject(DeveloperMode).set(true);
    // The app opening again.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: INDEXED_DB, useValue: indexedDb }] });

    await TestBed.runInInjectionContext(loadPlayerData);

    expect(TestBed.inject(RunStore).logs()).toEqual([run]);
    expect(TestBed.inject(KeypadLayoutSetting).layout()).toBe('telephone');
    expect(TestBed.inject(DiscoveryPaceSetting).pace()).toBe('faster');
    expect(TestBed.inject(DeveloperMode).enabled()).toBe(true);
  });
});
