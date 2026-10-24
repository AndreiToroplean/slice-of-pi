import { TestBed } from '@angular/core/testing';
import { Tweaks } from '../developer-mode/tweaks';
import { KeypadKey, KeypadLayout, KeypadTouch } from '../game/layers/keypad-layout';
import { KeypadLayoutSetting } from './keypad-layout-setting';
import { Run, runOf } from './run';
import { TOUCH_LOG_FORMAT, TouchLog } from './touch-log';
import { RUN_CLOCK, RunRecorder } from './run-recorder';
import { RunStore } from './run-store';

describe('RunRecorder', () => {
  let time: number;
  let ids: number;
  let saves: TouchLog[];
  let deletes: string[];
  let persist: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
  /** Saves hold until released, when set. */
  let held: (() => void)[] | undefined;
  let failing: boolean;
  /** Whether the game checks the digits. */
  let checking: boolean;
  /** The keypad layout the player picked. */
  let layout: KeypadLayout;

  beforeEach(() => {
    checking = true;
    layout = 'calculator';
    time = 5_000;
    ids = 0;
    saves = [];
    deletes = [];
    held = undefined;
    failing = false;
    persist = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        { provide: Tweaks, useValue: { checking: () => checking } },
        { provide: KeypadLayoutSetting, useValue: { layout: () => layout } },
        {
          provide: RUN_CLOCK,
          useValue: {
            now: () => time,
            epoch: () => 1_760_000_000_000 + time,
            newId: () => `run-${String(++ids)}`,
          },
        },
        {
          provide: RunStore,
          useValue: {
            save: async (log: TouchLog) => {
              if (held !== undefined) {
                await new Promise<void>((resolve) => held?.push(resolve));
              }
              if (failing) {
                throw new Error('disk full');
              }
              saves.push(log);
            },
            delete: (id: string) => {
              deletes.push(id);
              return Promise.resolve();
            },
            persist,
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Types these keys, `<` for backspace, one every `step` milliseconds. */
  function press(recorder: RunRecorder, keys: string, step = 200): void {
    for (const key of keys) {
      touch(recorder, { key: (key === '<' ? 'backspace' : key) as KeypadKey }, step);
    }
  }

  function touch(recorder: RunRecorder, touched: KeypadTouch, step = 200): void {
    recorder.record(touched);
    time += step;
  }

  /** The touch log last saved of each run not deleted, in order of their first save. */
  function storedLogs(): TouchLog[] {
    const logs = new Map<string, TouchLog>();
    for (const log of saves) {
      logs.set(log.id, log);
    }
    return [...logs.values()].filter((log) => !deletes.includes(log.id));
  }

  /** The runs of the touch logs stored. */
  function stored(): Run[] {
    return storedLogs().map(runOf);
  }

  it('saves the touch log of the run after every key', async () => {
    const recorder = TestBed.inject(RunRecorder);

    press(recorder, '1');
    await recorder.saved();
    press(recorder, '4');
    await recorder.saved();

    expect(saves.map((log) => log.touches.length)).toEqual([1, 2]);
    expect(storedLogs()).toEqual([
      {
        format: TOUCH_LOG_FORMAT,
        id: 'run-1',
        checked: true,
        keypadLayout: 'calculator',
        startedAt: 1_760_000_005_000,
        touches: [
          { key: '1', time: 0 },
          { key: '4', time: 200 },
        ],
      },
    ]);
  });

  it('records every touch from the first digit, where it was, those typing nothing included', async () => {
    const recorder = TestBed.inject(RunRecorder);

    touch(recorder, { key: null, x: -1, y: 2 });
    touch(recorder, { key: '1', x: -0.8, y: 1.2 });
    touch(recorder, { key: null, x: 2.1234, y: 0 });
    touch(recorder, { key: '4', x: -1, y: 0 });
    await recorder.saved();

    expect(storedLogs()[0]?.touches).toEqual([
      { key: '1', x: -0.8, y: 1.2, time: 0 },
      { key: null, x: 2.123, y: 0, time: 200 },
      { key: '4', x: -1, y: 0, time: 400 },
    ]);
    expect(stored()).toMatchObject([{ digits: '14', times: [0, 400] }]);
  });

  it('shows the run being played as recorded so far, until it ends', () => {
    const recorder = TestBed.inject(RunRecorder);
    expect(recorder.run()).toBeUndefined();

    press(recorder, '145<');
    expect(recorder.run()).toMatchObject({ digits: '14', times: [0, 200] });

    recorder.end();
    expect(recorder.run()).toBeUndefined();
  });

  it('tells how long it has been since the last digit, counted from a backspace after one', () => {
    const recorder = TestBed.inject(RunRecorder);

    press(recorder, '14', 200);
    expect(recorder.waited()).toBe(200);

    press(recorder, '5<', 300);
    expect(recorder.waited()).toBe(300);
  });

  it('shows no run once every digit is deleted', () => {
    const recorder = TestBed.inject(RunRecorder);

    press(recorder, '1<');

    expect(recorder.run()).toBeUndefined();
  });

  it('leaves no trace of a deleted digit: the next interval runs from the backspace', async () => {
    const recorder = TestBed.inject(RunRecorder);

    // 1 at 0, 4 at 200, a wrong 5 at 400, backspace at 900, 1 at 1200.
    press(recorder, '14', 200);
    press(recorder, '5', 500);
    press(recorder, '<', 300);
    press(recorder, '1');
    await recorder.saved();

    // As if 1 had come 300ms after 4, with no mistake.
    expect(stored()).toMatchObject([{ digits: '141', times: [0, 200, 500] }]);
    expect(storedLogs()[0]?.touches.map(({ key }) => key)).toEqual([
      '1',
      '4',
      '5',
      'backspace',
      '1',
    ]);
  });

  it('keeps nothing of a wrong first digit deleted', async () => {
    const recorder = TestBed.inject(RunRecorder);

    press(recorder, '9<');
    await recorder.saved();

    expect(saves).toEqual([]);
    expect(recorder.run()).toBeUndefined();
  });

  it('takes the clock back one digit per backspace', async () => {
    const recorder = TestBed.inject(RunRecorder);

    // 1 at 0, 4 at 300, 1 at 500, backspaces at 1000 and 1100, 4 at 1500.
    press(recorder, '1', 300);
    press(recorder, '4', 200);
    press(recorder, '1', 500);
    press(recorder, '<', 100);
    press(recorder, '<', 400);
    press(recorder, '4');
    await recorder.saved();

    expect(stored()).toMatchObject([{ digits: '14', times: [0, 400] }]);
  });

  it('starts a run only with a digit, keeping no touch before it', async () => {
    const recorder = TestBed.inject(RunRecorder);

    press(recorder, '<<');
    touch(recorder, { key: null, x: 0, y: 3 });
    press(recorder, '1');
    await recorder.saved();

    expect(stored()).toMatchObject([{ digits: '1', times: [0], startedAt: 1_760_000_005_600 }]);
    expect(storedLogs()[0]?.touches).toHaveLength(1);
  });

  it('deletes the run when every digit is deleted, and starts a new one with the next digit', async () => {
    const recorder = TestBed.inject(RunRecorder);

    press(recorder, '14<<<');
    press(recorder, '14');
    await recorder.saved();

    expect(deletes).toEqual(['run-1']);
    expect(stored()).toEqual([
      {
        id: 'run-2',
        checked: true,
        keypadLayout: 'calculator',
        startedAt: 1_760_000_006_000,
        digits: '14',
        times: [0, 200],
      },
    ]);
  });

  it('starts a new run with the next digit once a run is ended', async () => {
    const recorder = TestBed.inject(RunRecorder);

    press(recorder, '14');
    recorder.end();
    press(recorder, '<1');
    await recorder.saved();

    expect(stored()).toMatchObject([
      { id: 'run-1', digits: '14' },
      { id: 'run-2', digits: '1', times: [0] },
    ]);
  });

  it('records the keypad layout the run is played on', async () => {
    const recorder = TestBed.inject(RunRecorder);
    layout = 'telephone';

    press(recorder, '1');
    await recorder.saved();

    expect(stored()[0]?.keypadLayout).toBe('telephone');
  });

  it('marks a run started without checking the digits as unchecked', async () => {
    const recorder = TestBed.inject(RunRecorder);

    checking = false;
    press(recorder, '1');
    checking = true;
    press(recorder, '4');
    recorder.end();
    press(recorder, '1');
    await recorder.saved();

    expect(stored()).toMatchObject([
      { id: 'run-1', digits: '14', checked: false },
      { id: 'run-2', digits: '1', checked: true },
    ]);
  });

  it('asks for persistent storage when a run starts', async () => {
    const recorder = TestBed.inject(RunRecorder);

    press(recorder, '<');
    expect(persist).not.toHaveBeenCalled();

    press(recorder, '14');
    await recorder.saved();
    expect(persist).toHaveBeenCalledOnce();
  });

  it('collapses the saves of keys pressed while a save is under way, keeping the latest', async () => {
    held = [];
    const recorder = TestBed.inject(RunRecorder);

    press(recorder, '1');
    press(recorder, '415');
    const release = (): void => {
      for (const resolve of held?.splice(0) ?? []) {
        resolve();
      }
    };
    const saved = recorder.saved();
    await Promise.resolve();
    release();
    await new Promise((resolve) => setTimeout(resolve));
    release();
    await saved;

    expect(saves.map((log) => runOf(log).digits)).toEqual(['1', '1415']);
  });

  it('keeps recording when a save fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const recorder = TestBed.inject(RunRecorder);

    failing = true;
    press(recorder, '1');
    await recorder.saved();
    failing = false;
    press(recorder, '4');
    await recorder.saved();

    expect(error).toHaveBeenCalledOnce();
    expect(stored()).toMatchObject([{ digits: '14' }]);
  });
});
