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

  function heights(layers: ReturnType<typeof groupSizesView>['layers']): number[][] {
    return layers.map((layer) =>
      layer.kind === 'bars' ? layer.bars.map((bar) => bar.height) : [],
    );
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
