import type { BreakModelKind, Group, Hyperparameter, Settings } from './break-model';
import {
  fitToGroupings,
  labelsOf,
  Progress,
  runCountCurve,
  scoreGroups,
  sliderValues,
} from './fit-to-groupings';

describe('Fitting to groupings', () => {
  /** Groups of these sizes, from the first digit, the last one open. */
  function groupsOf(sizes: readonly number[]): Group[] {
    let start = 0;
    return sizes.map((size, k) => {
      const group = { start, size, open: k === sizes.length - 1, trusted: true };
      start += size;
      return group;
    });
  }

  function slider(key: string, min: number, max: number, step: number): Hyperparameter {
    return {
      key,
      label: key,
      min,
      max,
      step,
      format: String,
      help: { what: '', why: '', moving: '' },
    };
  }

  /**
   * A model that groups the digits of the longest run by the size it takes from its settings (by default `size`, with
   * `ignored` changing nothing), and counts the settings it was created with.
   */
  function sizedModel(
    sizeOf: (settings: Settings) => number = (settings) => settings['size'] ?? 5,
  ): BreakModelKind & { created: number } {
    const kind = {
      id: 'sized',
      label: 'Sized',
      description: '',
      defaults: { size: 5, ignored: 2 },
      tabs: [
        { name: 'All', hyperparameters: [slider('size', 1, 9, 1), slider('ignored', 0, 4, 1)] },
      ],
      created: 0,
      create: (settings: Settings) => {
        kind.created++;
        const size = sizeOf(settings);
        return {
          play: () => {
            throw new Error('Not played');
          },
          stats: (runs: readonly (readonly number[])[]) => {
            const digits = Math.max(0, ...runs.map((run) => run.length));
            const sizes = Array.from({ length: Math.ceil(digits / size) }, (_, k) =>
              Math.min(size, digits - k * size),
            );
            return {
              runs: [],
              usual: [],
              groups: groupsOf(sizes),
              speedCurve: [],
              averageTime: [],
              confidence: [],
            };
          },
        };
      },
    };
    return kind;
  }

  const run = Array.from({ length: 30 }, (_, i) => i * 200);

  it('puts a break before the first digit of each group but the first', () => {
    const labels = labelsOf([4, 3, 5]);

    expect([...labels.breaks]).toEqual([4, 7]);
    expect(labels.digits).toBe(12);
  });

  it('counts the breaks matched, extra and missed', () => {
    const score = scoreGroups(groupsOf([4, 4, 4]), labelsOf([4, 3, 5]));

    expect(score).toEqual({ matched: 1, extra: 1, missed: 1, f1: 0.5 });
  });

  it('scores only the places both the groups and the labels reach', () => {
    expect(scoreGroups(groupsOf([3, 3]), labelsOf([3, 3, 3, 3])).f1).toBe(1);
    expect(scoreGroups(groupsOf([3, 3, 3, 3]), labelsOf([3, 3])).f1).toBe(1);
  });

  it('scores no breaks to find, none found, as a perfect match', () => {
    expect(scoreGroups(groupsOf([6]), labelsOf([6])).f1).toBe(1);
  });

  it('takes every value of a slider, a step apart', () => {
    expect(sliderValues(slider('x', 0.05, 0.3, 0.05))).toEqual([0.05, 0.1, 0.15, 0.2, 0.25, 0.3]);
    expect(sliderValues(slider('x', 3, 9, 2))).toEqual([3, 5, 7, 9]);
  });

  it('finds the hyperparameters whose groups are the labels', async () => {
    const fit = await fitToGroupings(sizedModel(), {}, [run], labelsOf(Array<number>(10).fill(3)));

    expect(fit.settings).toEqual({ size: 3, ignored: 2 });
    expect(fit.score.f1).toBe(1);
  });

  it('keeps the values it starts from where none score better', async () => {
    const fit = await fitToGroupings(
      sizedModel(),
      { size: 3, ignored: 4 },
      [run],
      labelsOf(Array<number>(10).fill(3)),
    );

    expect(fit.settings).toEqual({ size: 3, ignored: 4 });
  });

  it('tells how far it has gone', async () => {
    const seen: Progress[] = [];
    await fitToGroupings(sizedModel(), {}, [run], labelsOf([3, 3, 3]), {
      pause: (progress) => {
        seen.push(progress);
        return Promise.resolve();
      },
    });
    const stages = seen.map((progress) =>
      progress.stage === 'yours'
        ? `yours, pass ${String(progress.pass)}`
        : progress.stage === 'drawing'
          ? `drawing ${String(progress.draws)}`
          : `pick ${String(progress.pick)} of ${String(progress.picks)}, pass ${String(progress.pass)}`,
    );

    // Refining the values started from, then random draws, then refining the 3 best draws, each in passes until one
    // finds nothing better.
    expect([...new Set(stages)]).toEqual([
      'yours, pass 1',
      'yours, pass 2',
      'drawing 300',
      'pick 1 of 3, pass 1',
      'pick 2 of 3, pass 1',
      'pick 3 of 3, pass 1',
    ]);
    expect(stages.filter((stage) => stage === 'drawing 300')).toHaveLength(300);
    expect(seen.at(-1)?.done).toBe(1);
  });

  it('looks past the values near where it starts', async () => {
    // Only the right size and the right other value together make the groups: one slider at a time can't find them.
    const kind = sizedModel((settings) =>
      settings['ignored'] === 3 ? (settings['size'] ?? 5) : 5,
    );
    const fit = await fitToGroupings(kind, {}, [run], labelsOf(Array<number>(10).fill(3)));

    expect(fit.score.f1).toBe(1);
    expect(fit.settings).toEqual({ size: 3, ignored: 3 });
  });

  it('stops when asked, with the best found so far', async () => {
    const kind = sizedModel();
    const abort = new AbortController();
    const fit = await fitToGroupings(kind, {}, [run], labelsOf([3, 3, 3]), {
      signal: abort.signal,
      pause: () => {
        abort.abort();
        return Promise.resolve();
      },
    });

    expect(kind.created).toBe(2);
    expect(fit.settings).toEqual({ size: 1, ignored: 2 });
  });

  describe('run-count curve', () => {
    /**
     * A model that groups 12 digits in groups as long as the number of runs it's given, and keeps the runs it's given,
     * each run being only the number it's known by.
     */
    function countingModel(): BreakModelKind & { given: number[][] } {
      const kind = {
        ...sizedModel(),
        given: [] as number[][],
        create: () => ({
          play: () => {
            throw new Error('Not played');
          },
          stats: (runs: readonly (readonly number[])[]) => {
            kind.given.push(runs.map((each) => each[0] ?? -1));
            const size = runs.length;
            return {
              runs: [],
              usual: [],
              groups: groupsOf(Array<number>(12 / size).fill(size)),
              speedCurve: [],
              averageTime: [],
              confidence: [],
            };
          },
        }),
      };
      return kind;
    }

    const runs = [[0], [1], [2], [3]];

    it('scores sets of each number of runs, up to all of them', async () => {
      const curve = await runCountCurve(countingModel(), {}, runs, labelsOf([3, 3, 3, 3]));

      expect(curve.map((scores) => scores.length)).toEqual([5, 5, 5, 1]);
      expect(curve[2]).toEqual([1, 1, 1, 1, 1]);
      expect(curve[3]).toEqual([scoreGroups(groupsOf([4, 4, 4]), labelsOf([3, 3, 3, 3])).f1]);
    });

    it('draws different sets of runs, each oldest first, the same every time', async () => {
      const kind = countingModel();
      await runCountCurve(kind, {}, runs, labelsOf([3, 3, 3, 3]));
      const first = kind.given;
      kind.given = [];
      await runCountCurve(kind, {}, runs, labelsOf([3, 3, 3, 3]));

      expect(kind.given).toEqual(first);
      expect(new Set(first.filter((set) => set.length === 2).map(String)).size).toBeGreaterThan(1);
      for (const set of first) {
        expect(set).toEqual([...set].sort((a, b) => a - b));
        expect(new Set(set).size).toBe(set.length);
      }
    });

    it('tells how far it has gone, and stops when asked', async () => {
      const seen: number[] = [];
      const abort = new AbortController();
      const curve = await runCountCurve(countingModel(), {}, runs, labelsOf([3, 3, 3, 3]), {
        signal: abort.signal,
        pause: (done) => {
          seen.push(done);
          if (seen.length === 7) {
            abort.abort();
          }
          return Promise.resolve();
        },
      });

      expect(seen.at(-1)).toBe(7 / 16);
      expect(curve).toHaveLength(1);
    });
  });
});
