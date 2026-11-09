import { TestBed } from '@angular/core/testing';
import { Tweaks } from '../../developer-mode/tweaks';
import { Digit } from '../../game/pi/digit';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { RunStore } from '../../player-data/run-store';
import { newTouchLog, TouchLog } from '../../player-data/touch-log';
import { setUpPlayerData } from '../../../testing/player-data-pages';
import { typeKey } from '../../../testing/touch-logs';
import { dateAndTime, RunsState } from './runs-state';

describe('RunsState', () => {
  const first = typeKey(typeKey(newTouchLog('a', 1_000), '1', 0), '4', 250);
  const second = typeKey(newTouchLog('b', 2_000), '1', 0);
  // Groups of 3: about 200 ms between digits, 700 ms before every fourth.
  const grouped = Array.from(PI_DECIMALS.slice(0, 30)).reduce(
    (run, digit, i) =>
      typeKey(
        run,
        digit as Digit,
        i === 0 ? 0 : (run.touches.at(-1)?.time ?? 0) + (i % 3 ? ([180, 230][i % 2] ?? 0) : 700),
      ),
    newTouchLog('c', 3_000),
  );
  const groupsBy3 = PI_DECIMALS.slice(0, 30).match(/.../g) ?? [];
  const unchecked = { ...grouped, id: 'unchecked', checked: false };
  const third = { ...grouped, id: 'third', startedAt: 3_000 };
  /** The questions the player was asked to confirm. */
  let questions: string[];

  /** The runs, read, as a page of them shows them, in developer mode, where the tweaks apply. */
  async function setUp(
    runs: TouchLog[],
    { includeUnchecked = false, confirming = true } = {},
  ): Promise<RunsState> {
    questions = [];
    await setUpPlayerData(
      {
        runs,
        developer: true,
        confirm: (question) => {
          questions.push(question);
          return confirming;
        },
      },
      [RunsState],
    );
    if (includeUnchecked) {
      await TestBed.inject(Tweaks).setIncludeUnchecked(true);
    }
    return TestBed.inject(RunsState);
  }

  const ids = (state: RunsState): string[] => state.charts().map((chart) => chart.id);
  const later = (state: RunsState): boolean[] => state.charts().map((chart) => chart.later);
  const groups = (state: RunsState): string[] => state.groups().map((group) => group.digits);
  const runOrder = () => TestBed.inject(Tweaks).values().runOrder;

  it('charts each run, oldest first, counting its digits, time and groups', async () => {
    const state = await setUp([second, first, grouped]);

    expect(ids(state)).toEqual(['a', 'b', 'c']);
    expect(state.charts()[0]?.title).toBe(dateAndTime.format(1_000));
    expect(state.charts().map((chart) => chart.meta)).toEqual([
      '2 digits in 0.3 s · 1 group',
      '1 digit in 0.0 s · 1 group',
      '30 digits in 10.4 s · 10 groups',
    ]);
    expect(state.charts()[2]?.breaks).toHaveLength(9);
  });

  it('charts a run from a checkpoint from it on, and spans the charts to the place it reached', async () => {
    const fromCheckpoint = typeKey(
      typeKey(newTouchLog('d', 4_000, true, 'calculator', { start: 40 }), '6', 0),
      '9',
      300,
    );
    const state = await setUp([first, fromCheckpoint]);

    expect(ids(state)).toEqual(['a', 'd']);
    expect(state.charts()[1]?.meta).toBe('2 digits from 40 in 0.3 s · 1 group');
    expect(state.charts()[1]?.times.slice(40)).toEqual([undefined, 300]);
    expect(state.places()).toBe(42);
  });

  it('charts Discover’s runs as they’re kept, without groups, as they don’t count in them', async () => {
    const discovered = typeKey(
      typeKey(newTouchLog('e', 5_000, true, 'calculator', { recording: 'overwrite' }), '1', 0),
      '4',
      300,
    );
    const without = groups(await setUp([grouped]));
    TestBed.resetTestingModule();
    const state = await setUp([grouped, discovered]);

    expect(ids(state)).toEqual(['c', 'e']);
    expect(state.charts()[1]?.meta).toBe('2 digits in 0.3 s');
    expect(state.charts()[1]?.times).toEqual([undefined, 300]);
    expect(groups(state)).toEqual(without);
  });

  it('spans every chart over the places of the longest run shown', async () => {
    expect((await setUp([first, second, unchecked])).places()).toBe(2);
    TestBed.resetTestingModule();
    expect((await setUp([first, second, unchecked], { includeUnchecked: true })).places()).toBe(30);
  });

  describe('unchecked runs', () => {
    it('hides them and leaves them out of the groups, unless told to include them, marked', async () => {
      const state = await setUp([grouped, unchecked]);
      expect(ids(state)).toEqual(['c']);
      expect(groups(state)).toEqual([PI_DECIMALS.slice(0, 30)]);

      await TestBed.inject(Tweaks).setIncludeUnchecked(true);

      expect(state.charts().map((chart) => [chart.id, chart.checked])).toEqual([
        ['c', true],
        ['unchecked', false],
      ]);
      expect(groups(state)).toEqual(groupsBy3);
    });
  });

  describe('playing from a run', () => {
    // A run grouped by 3, one to play from, then three grouped by 3 played after it.
    const from = { ...grouped, id: 'from', startedAt: 3_001 };
    const trusted = ['d', 'e', 'f'].map((id, i) => ({ ...grouped, id, startedAt: 4_000 + i }));
    const runs: TouchLog[] = [grouped, from, ...trusted];

    it('plays from after a run, as if those after it had not been played', async () => {
      const state = await setUp(runs);
      expect(state.aggregateTitle()).toBe('All runs');

      state.playFrom('c');
      await vi.waitFor(() => {
        expect(runOrder()).toEqual({ ids: ['c', 'from', 'd', 'e', 'f'], line: 1 });
      });

      expect(later(state)).toEqual([false, true, true, true, true]);
      expect(state.rows().map((row) => row.id)).toEqual(['c', '', 'from', 'd', 'e', 'f']);
      expect(state.aggregateTitle()).toBe('Runs before here');
      expect(state.counted().map((run) => run.id)).toEqual(['c']);
    });

    it('plays from before all the runs', async () => {
      const state = await setUp(runs);

      state.playFrom();
      await vi.waitFor(() => {
        expect(runOrder()?.line).toBe(0);
      });

      expect(later(state)).toEqual([true, true, true, true, true]);
    });

    it('keeps the runs in the order shown when playing from a run while already playing from one', async () => {
      const state = await setUp(runs);
      // The runs played since come just before the line.
      await TestBed.inject(Tweaks).setRunOrder({ ids: ['c', 'from'], line: 1 });
      expect(ids(state)).toEqual(['c', 'd', 'e', 'f', 'from']);
      expect(later(state)).toEqual([false, false, false, false, true]);

      state.playFrom('e');
      await vi.waitFor(() => {
        expect(runOrder()).toEqual({ ids: ['c', 'd', 'e', 'f', 'from'], line: 3 });
      });
    });

    it('plays from after all the runs again once undone, keeping them in the order shown', async () => {
      const state = await setUp(runs);
      await TestBed.inject(Tweaks).setRunOrder({ ids: ['c', 'from'], line: 1 });

      state.undoPlayFrom();
      await vi.waitFor(() => {
        expect(runOrder()).toEqual({ ids: ['c', 'd', 'e', 'f', 'from'] });
      });

      expect(later(state)).toEqual([false, false, false, false, false]);
      expect(state.aggregateTitle()).toBe('All runs');
    });

    it('draws the line after all the runs when they all come before it', async () => {
      const state = await setUp(runs);

      await TestBed.inject(Tweaks).setRunOrder({ ids: runs.map((run) => run.id), line: 5 });

      expect(state.rows().map((row) => row.id)).toEqual(['c', 'from', 'd', 'e', 'f', '']);
    });
  });

  describe('reordering the runs', () => {
    it('moves a run or the line to another place among the rows', async () => {
      const state = await setUp([first, second, third]);
      await TestBed.inject(Tweaks).setRunOrder({ ids: ['a', 'b', 'third'], line: 2 });

      // The last run, under the line, to the top.
      state.move(3, 0);
      await vi.waitFor(() => {
        expect(runOrder()).toEqual({ ids: ['third', 'a', 'b'], line: 3 });
      });
      state.move(1, 1);

      expect(runOrder()).toEqual({ ids: ['third', 'a', 'b'], line: 3 });
    });

    it('puts the runs back in the order they were played in', async () => {
      const state = await setUp([first, second, third]);
      expect(state.chronological()).toBe(true);
      await TestBed.inject(Tweaks).setRunOrder({ ids: ['third', 'b', 'a'] });
      expect(state.chronological()).toBe(false);

      state.reorderChronologically();
      await vi.waitFor(() => {
        expect(state.chronological()).toBe(true);
      });

      expect(TestBed.inject(Tweaks).values()).toEqual({});
    });

    it('keeps the line under as many runs when putting them back in the order they were played in', async () => {
      const state = await setUp([first, second, third]);
      await TestBed.inject(Tweaks).setRunOrder({ ids: ['third', 'b', 'a'], line: 1 });

      state.reorderChronologically();
      await vi.waitFor(() => {
        expect(runOrder()).toEqual({ ids: ['a', 'b', 'third'], line: 1 });
      });
    });
  });

  describe('deleting runs', () => {
    it('deletes every run once the player confirms', async () => {
      const state = await setUp([first, second]);

      await state.deleteAll();

      expect(questions).toEqual([
        'Delete all 2 runs kept on this device? Only a backup file can bring them back.',
      ]);
      expect(state.message()).toBe('Deleted 2 runs.');
      expect(state.runs()).toEqual([]);
      expect(await TestBed.inject(RunStore).touchLogs()).toEqual([]);
    });

    it('keeps the runs when the player does not confirm', async () => {
      const state = await setUp([first], { confirming: false });

      await state.deleteAll();

      expect(questions).toEqual([
        'Delete the run kept on this device? Only a backup file can bring it back.',
      ]);
      expect(state.message()).toBe('');
      expect(await TestBed.inject(RunStore).touchLogs()).toEqual([first]);
    });

    it('deletes a run once the player confirms', async () => {
      const state = await setUp([first, second]);

      await state.deleteRun('a');

      expect(questions).toEqual(['Delete this run? Only a backup file can bring it back.']);
      expect(state.message()).toBe('Deleted the run.');
      expect(ids(state)).toEqual(['b']);
    });

    it('keeps the run when the player does not confirm', async () => {
      const state = await setUp([first, second], { confirming: false });

      await state.deleteRun('a');

      expect(await TestBed.inject(RunStore).touchLogs()).toEqual([first, second]);
    });
  });
});
