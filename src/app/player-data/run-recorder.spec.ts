import { TestBed } from '@angular/core/testing';
import { Tweaks } from '../developer-mode/tweaks';
import { KeypadKey, KeypadLayout } from '../game/layers/keypad-layout';
import { KeypadLayoutSetting } from './keypad-layout-setting';
import { Run, RUN_FORMAT } from './run';
import { RUN_CLOCK, RunRecorder } from './run-recorder';
import { RunStore } from './run-store';

describe('RunRecorder', () => {
  let time: number;
  let ids: number;
  let saves: Run[];
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
            save: async (run: Run) => {
              if (held !== undefined) {
                await new Promise<void>((resolve) => held?.push(resolve));
              }
              if (failing) {
                throw new Error('disk full');
              }
              saves.push(run);
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

  function press(recorder: RunRecorder, keys: string, step = 200): void {
    for (const key of keys) {
      recorder.record((key === '<' ? 'backspace' : key) as KeypadKey);
      time += step;
    }
  }

  /** The last save of each run not deleted, in order of their first save. */
  function stored(): Run[] {
    const runs = new Map<string, Run>();
    for (const run of saves) {
      runs.set(run.id, run);
    }
    return [...runs.values()].filter((run) => !deletes.includes(run.id));
  }

  it('saves the run after every key', async () => {
    const recorder = TestBed.inject(RunRecorder);

    press(recorder, '1');
    await recorder.saved();
    press(recorder, '4');
    await recorder.saved();

    expect(saves.map((run) => run.digits)).toEqual(['1', '14']);
    expect(stored()).toEqual([
      {
        format: RUN_FORMAT,
        id: 'run-1',
        checked: true,
        keypadLayout: 'calculator',
        startedAt: 1_760_000_005_000,
        digits: '14',
        times: [0, 200],
        backspaces: [],
      },
    ]);
  });

  it('shows the run being played as recorded so far, until it ends', () => {
    const recorder = TestBed.inject(RunRecorder);
    expect(recorder.run()).toBeUndefined();

    press(recorder, '145<');
    expect(recorder.run()).toMatchObject({ digits: '14', times: [0, 200], backspaces: [3] });

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
    expect(stored()).toMatchObject([{ digits: '141', times: [0, 200, 500], backspaces: [3] }]);
  });

  it("records the backspace deleting a wrong digit it never recorded, the clock going back as for a digit's", async () => {
    const recorder = TestBed.inject(RunRecorder);

    // 1 at 0, 4 at 200, a wrong 5 never recorded at 400, its backspace at 900, 1 at 1200.
    press(recorder, '14', 200);
    time += 500;
    recorder.deleteMistake(3);
    time += 300;
    press(recorder, '1');
    await recorder.saved();

    expect(stored()).toMatchObject([{ digits: '141', times: [0, 200, 500], backspaces: [3] }]);
  });

  it('records nothing for a wrong first digit deleted', async () => {
    const recorder = TestBed.inject(RunRecorder);

    recorder.deleteMistake(1);
    await recorder.saved();

    expect(saves).toEqual([]);
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

    expect(stored()).toMatchObject([{ digits: '14', times: [0, 400], backspaces: [3, 2] }]);
  });

  it('starts a run only with a digit', async () => {
    const recorder = TestBed.inject(RunRecorder);

    press(recorder, '<<1');
    await recorder.saved();

    expect(stored()).toMatchObject([{ digits: '1', times: [0], startedAt: 1_760_000_005_400 }]);
  });

  it('deletes the run when every digit is deleted, and starts a new one with the next digit', async () => {
    const recorder = TestBed.inject(RunRecorder);

    press(recorder, '14<<<');
    press(recorder, '14');
    await recorder.saved();

    expect(deletes).toEqual(['run-1']);
    expect(stored()).toEqual([
      {
        format: RUN_FORMAT,
        id: 'run-2',
        checked: true,
        keypadLayout: 'calculator',
        startedAt: 1_760_000_006_000,
        digits: '14',
        times: [0, 200],
        backspaces: [],
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
      { id: 'run-1', digits: '14', backspaces: [] },
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

    expect(saves.map((run) => run.digits)).toEqual(['1', '1415']);
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
