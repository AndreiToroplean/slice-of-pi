import { TestBed } from '@angular/core/testing';
import { KeypadKey } from '../keypad/keypad-layout';
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

  beforeEach(() => {
    time = 5_000;
    ids = 0;
    saves = [];
    deletes = [];
    held = undefined;
    failing = false;
    persist = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
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
        startedAt: 1_760_000_005_000,
        digits: '14',
        times: [0, 200],
        backspaces: [],
      },
    ]);
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
        startedAt: 1_760_000_006_000,
        digits: '14',
        times: [0, 200],
        backspaces: [],
      },
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
