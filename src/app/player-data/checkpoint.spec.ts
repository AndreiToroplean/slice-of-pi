import { TestBed } from '@angular/core/testing';
import { Digit } from '../game/pi/digit';
import { PI_DECIMALS } from '../game/pi/pi-decimals';
import { setUpPlayerData } from '../../testing/player-data-pages';
import { typeKey } from '../../testing/touch-logs';
import { Checkpoint, CHECKPOINTS, CHECKPOINTS_FORMAT } from './checkpoint';
import { RunStore } from './run-store';
import { newTouchLog, TouchLog } from './touch-log';

describe('Checkpoint', () => {
  /** A run typing the decimals from after `start` up to `reached`. */
  function run(id: string, reached: number, checked = true, start = 0): TouchLog {
    return Array.from(PI_DECIMALS.slice(start, reached)).reduce(
      (log, digit, i) => typeKey(log, digit as Digit, i * 200),
      newTouchLog(id, 0, checked, 'calculator', { start }),
    );
  }

  async function setUp(runs: TouchLog[]): Promise<Checkpoint> {
    await setUpPlayerData({ runs });
    return TestBed.inject(Checkpoint);
  }

  it('unlocks the checkpoints the checked runs reached, from a checkpoint too', async () => {
    const checkpoint = await setUp([run('a', 25), run('b', 60, false), run('c', 42, true, 30)]);

    expect(checkpoint.unlocked()).toEqual([10, 20, 30, 40]);
  });

  it('starts each game mode from the place picked for it, as far as it is unlocked', async () => {
    const checkpoint = await setUp([run('a', 60)]);
    expect(checkpoint.place('free')).toBe(0);
    expect(checkpoint.farthest()).toBe(60);

    await checkpoint.pick('free', 50);
    await checkpoint.pick('discover', 100);

    expect(checkpoint.place('free')).toBe(50);
    expect(checkpoint.place('challenge')).toBe(0);
    expect(checkpoint.place('discover')).toBe(60);
    expect(checkpoint.reachable(35)).toBe(30);
  });

  it('keeps the places picked for the next visits', async () => {
    await setUp([run('a', 60)]);
    await TestBed.inject(Checkpoint).pick('challenge', 40);
    const store = TestBed.inject(RunStore);
    const stored = await store.setting(CHECKPOINTS);
    TestBed.resetTestingModule();
    await setUpPlayerData({ runs: [run('a', 60)] });
    await TestBed.inject(RunStore).saveSetting(CHECKPOINTS, stored);

    const checkpoint = TestBed.inject(Checkpoint);
    await checkpoint.reload();

    expect(checkpoint.place('challenge')).toBe(40);
  });

  it('starts from the start of π for a stored place that is no checkpoint, or in a format it does not know', async () => {
    const checkpoint = await setUp([run('a', 60)]);
    const store = TestBed.inject(RunStore);

    await store.saveSetting(CHECKPOINTS, { format: CHECKPOINTS_FORMAT, places: { free: 15 } });
    await checkpoint.reload();
    expect(checkpoint.place('free')).toBe(0);

    await store.saveSetting(CHECKPOINTS, {
      format: CHECKPOINTS_FORMAT + 1,
      places: { free: 20 },
    });
    await checkpoint.reload();
    expect(checkpoint.place('free')).toBe(0);
  });
});
