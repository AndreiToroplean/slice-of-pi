import { MARS } from '../../../game/grouping/break-models/mars';
import type { Steps } from '../../../game/grouping/break-models/steps';
import { groupSizesView, withinGroupsView } from './group-views';
import type { ViewInput } from './view-input';

describe('the views of the groups', () => {
  /** The times of a run typed about 200 ms apart, pausing 700 ms before every third digit. */
  function run(digits: number): number[] {
    let time = 0;
    return Array.from({ length: digits }, (_, i) => {
      if (i > 0) {
        time += i % 3 === 0 ? 700 : ([180, 200, 230][i % 3] ?? 0);
      }
      return time;
    });
  }

  function stepsOf(steps: Steps | undefined): Steps {
    if (steps === undefined) {
      throw new Error('No steps');
    }
    return steps;
  }

  const model = stepsOf(MARS.steps?.({}, [run(30), run(30), run(24)]));
  const input: ViewInput = { model, picked: [], aggregate: true, places: 30 };

  /** The heights of the bars of each layer, those faded aside. */
  function heights(layers: ReturnType<typeof groupSizesView>['layers']): number[][] {
    return layers
      .filter((layer) => layer.kind !== 'bars' || layer.faded !== true)
      .map((layer) => (layer.kind === 'bars' ? layer.bars.map((bar) => bar.height) : []));
  }

  it("counts how big the groups are, as shares: the game's, each run's own, and the player's", () => {
    const [played = [], own = [], mine = []] = heights(groupSizesView(input, [4, 4, 5]).layers);
    const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

    expect(sum(played)).toBeCloseTo(1, 12);
    expect(sum(own)).toBeCloseTo(1, 12);
    // A pause before every third digit: groups of 3.
    expect(played.indexOf(Math.max(...played))).toBe(2);
    expect(mine.slice(3, 5)).toEqual([2 / 3, 1 / 3]);
    expect(heights(groupSizesView(input).layers)[2]).toEqual([]);
  });

  it('draws the group-size envelope over the sizes, 1 at the top, if it changes anything', () => {
    const curve = (plot: ReturnType<typeof groupSizesView>) => {
      const line = plot.layers.find((layer) => layer.kind === 'line');
      return line?.kind === 'line' ? line.points : [];
    };
    const plot = groupSizesView(input);
    const at = (size: number) =>
      curve(plot).find((point) => point !== undefined && Math.abs(point[0] - size) < 1e-9)?.[1];
    const flat = stepsOf(
      MARS.steps?.({ envelopeFactor1: 1, envelopeFactor3: 1, envelopeFactor4: 1 }, [run(30)]),
    );

    // Half of it at 1 digit, all of it at 5, half again at 8, nothing past 10.
    const top = at(5) ?? Number.NaN;
    expect(top).toBeCloseTo((plot.y.max * 10) / 11, 12);
    expect(at(1)).toBeCloseTo(top / 2, 12);
    expect(at(8)).toBeCloseTo(top / 2, 12);
    expect(at(11)).toBe(0);
    expect(curve(groupSizesView({ ...input, model: flat }))).toEqual([]);
  });

  it('shows the sizes the envelope makes, and faded behind them, those without it', () => {
    // A pause before every twelfth digit: groups of 12, which the envelope rules out.
    const long = Array.from({ length: 3 }, () => {
      let time = 0;
      return Array.from({ length: 40 }, (_, i) => {
        if (i > 0) {
          time += i % 12 === 0 ? 900 : ([180, 200, 230][i % 3] ?? 0);
        }
        return time;
      });
    });
    const plot = groupSizesView({ ...input, model: stepsOf(MARS.steps?.({}, long)) });
    const at12 = (faded: boolean, role: string) =>
      plot.layers.flatMap((layer) =>
        layer.kind === 'bars' && layer.role === role && (layer.faded ?? false) === faded
          ? [layer.bars[11]?.height]
          : [],
      );

    expect(at12(true, 'aggregate')).toEqual([1]);
    expect(at12(true, 'run')).toEqual([1]);
    expect(at12(false, 'aggregate')).toEqual([0]);
    expect(at12(false, 'run')).toEqual([0]);
  });

  it('shows the pause before each group at its first digit, and steady digits after it', () => {
    const plot = withinGroupsView(input);
    const mean = plot.layers.find((layer) => layer.kind === 'line');
    const points = mean?.kind === 'line' ? mean.points : [];
    const at = (digit: number) => points.find((point) => point?.[0] === digit)?.[1] ?? NaN;

    expect(at(1)).toBeGreaterThan(at(2) + 0.5);
    expect(Math.abs(at(2) - at(3))).toBeLessThan(0.3);
    expect(points.filter((point) => point !== undefined).map((point) => point[0])).toEqual([
      1, 2, 3,
    ]);
  });
});
