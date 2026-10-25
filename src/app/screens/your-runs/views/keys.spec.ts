import { MARS } from '../../../game/grouping/break-models/mars';
import {
  finishedRuns,
  mercury,
  MERCURY_DEFAULTS,
} from '../../../game/grouping/break-models/mercury';
import type { Steps } from '../../../game/grouping/break-models/steps';
import { groupViews } from './group-views';
import { modelViews } from './model-views';
import { placeAnalysis } from './place-views';
import { keyIdOf, keyIdOfLayer, Plot } from './plot';

describe('the keys to the views of the break model', () => {
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

  const runs = [run(30), run(30), run(24)];

  function stepsOf(steps: Steps | undefined): Steps {
    if (steps === undefined) {
      throw new Error('No steps');
    }
    return steps;
  }

  const models: Record<string, Steps> = {
    Mars: stepsOf(MARS.steps?.({}, runs)),
    Mercury: mercury(finishedRuns(runs, MERCURY_DEFAULTS.window), undefined, MERCURY_DEFAULTS),
  };

  /** The kinds of mark a plot draws that its key doesn't tell. */
  function unkeyed(plot: Plot): string[] {
    const keys = new Set((plot.legend ?? []).map(keyIdOf));
    return plot.layers
      .map(keyIdOfLayer)
      .filter((id) => !keys.has(id))
      .map((id) => `${plot.title}: ${id}`);
  }

  /** The keys of a plot that show the same marks as another: none, so that each toggles its own. */
  function twins(plot: Plot): string[] {
    const ids = (plot.legend ?? []).map(keyIdOf);
    return ids.filter((id, k) => ids.indexOf(id) !== k).map((id) => `${plot.title}: ${id}`);
  }

  for (const [name, model] of Object.entries(models)) {
    it(`tells what every kind of mark stands for, along the places and in groups, in ${name}`, () => {
      for (const picked of [[], [1]]) {
        const input = { model, picked, aggregate: true, places: 30 };
        const views = [...modelViews(input), ...groupViews(input, [3, 3, 4])];

        expect(views.flatMap(unkeyed)).toEqual([]);
        expect(views.flatMap(twins)).toEqual([]);
      }
    });

    it(`tells what every kind of mark stands for, at a place, in ${name}`, () => {
      for (const place of [14, 15]) {
        const { plots } = placeAnalysis({ model, place, picked: [1], titles: [] });

        expect(plots.flatMap(unkeyed)).toEqual([]);
        expect(plots.flatMap(twins)).toEqual([]);
      }
    });
  }
});
