import { TestBed } from '@angular/core/testing';
import { Digit } from '../game/pi/digit';
import { PI_DECIMALS } from '../game/pi/pi-decimals';
import { setUpPlayerData } from '../../testing/player-data-pages';
import { typeKey } from '../../testing/touch-logs';
import { Checkpoint } from './checkpoint';
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
    const checkpoint = TestBed.inject(Checkpoint);
    await checkpoint.refresh();
    return checkpoint;
  }

  it('unlocks the checkpoints the checked runs reached, from a checkpoint too', async () => {
    const checkpoint = await setUp([run('a', 25), run('b', 60, false), run('c', 42, true, 30)]);

    expect(checkpoint.unlocked()).toEqual([10, 20, 30, 40]);
  });

  it('starts games from the start of π, or the checkpoint picked while it’s unlocked', async () => {
    const checkpoint = await setUp([run('a', 60)]);
    expect(checkpoint.start()).toBe(0);

    checkpoint.pick(50);
    expect(checkpoint.start()).toBe(50);

    checkpoint.pick(100);
    expect(checkpoint.start()).toBe(0);
  });
});
