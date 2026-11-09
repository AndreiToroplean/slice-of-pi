import { TestBed } from '@angular/core/testing';
import { KeypadLayoutSetting } from './keypad-layout-setting';
import { runOf } from './run';
import { RUN_CLOCK } from './run-recorder';
import { RunStore } from './run-store';
import { DiscoverRecorder } from './discover-recorder';
import { TouchLog } from './touch-log';

describe('DiscoverRecorder', () => {
  let time: number;
  let saves: TouchLog[];

  beforeEach(() => {
    time = 0;
    saves = [];
    TestBed.configureTestingModule({
      providers: [
        DiscoverRecorder,
        { provide: KeypadLayoutSetting, useValue: { layout: () => 'calculator' } },
        {
          provide: RUN_CLOCK,
          useValue: { now: () => time, epoch: () => 1_000 + time, newId: () => 'session' },
        },
        {
          provide: RunStore,
          useValue: {
            save: (log: TouchLog) => {
              saves.push(log);
              return Promise.resolve();
            },
            persist: () => Promise.resolve(true),
          },
        },
      ],
    });
  });

  /** Types the digits of π from the place `from`, 200 ms apart. */
  function round(recorder: DiscoverRecorder, from: number, digits: string, start = 0): void {
    Array.from(digits).forEach((key, i) => {
      time += 200;
      recorder.record({ key: key as '1' }, from + i, start);
    });
  }

  it('keeps the latest typing of each place, as one overwriting run, saved after every digit', async () => {
    const recorder = TestBed.inject(DiscoverRecorder);

    round(recorder, 0, '1');
    round(recorder, 0, '14');
    round(recorder, 0, '141');
    await recorder.saved();

    expect(saves).toHaveLength(6);
    const log = saves.at(-1);
    expect(log?.recording).toBe('overwrite');
    expect(log?.touches.map(({ key, time }) => [key, time])).toEqual([
      ['1', 600],
      ['4', 800],
      ['1', 1000],
    ]);
  });

  it('drops the places after the one typed, from an earlier round, keeping the touches in order', async () => {
    const recorder = TestBed.inject(DiscoverRecorder);

    round(recorder, 0, '141');
    round(recorder, 0, '1');
    await recorder.saved();

    expect(saves.at(-1)?.touches.map(({ key }) => key)).toEqual(['1']);
  });

  it('times the first digit of a turn as when last typed straight after the digit before', async () => {
    const recorder = TestBed.inject(DiscoverRecorder);

    recorder.newTurn();
    round(recorder, 0, '141');
    time += 100;
    round(recorder, 3, '5');
    // The game's turn, then the player's, from a checkpoint's group at 3, after a while.
    time += 10_000;
    recorder.newTurn();
    time += 2_000;
    round(recorder, 3, '59');
    await recorder.saved();

    expect(saves.at(-1)?.touches.map(({ time }) => time)).toEqual([0, 200, 400, 700, 900]);
  });

  it('records a session from a checkpoint from its place, its clock stopped while paused', async () => {
    const recorder = TestBed.inject(DiscoverRecorder);

    round(recorder, 50, '5', 50);
    recorder.pause();
    time += 5_000;
    recorder.resume();
    round(recorder, 50, '58', 50);
    await recorder.saved();

    const log = saves.at(-1);
    expect(log?.start).toBe(50);
    expect(log?.touches.map(({ time }) => time)).toEqual([200, 400]);
    expect(log === undefined ? '' : runOf(log).digits).toBe('58');
  });

  it('starts a new run once the session ends', async () => {
    let ids = 0;
    TestBed.overrideProvider(RUN_CLOCK, {
      useValue: { now: () => time, epoch: () => time, newId: () => `session-${String(++ids)}` },
    });
    const recorder = TestBed.inject(DiscoverRecorder);

    round(recorder, 0, '1');
    recorder.end();
    round(recorder, 0, '1');
    await recorder.saved();

    expect(saves.map((log) => log.id)).toEqual(['session-1', 'session-2']);
  });
});
