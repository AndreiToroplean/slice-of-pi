import { MARS } from '../../../game/grouping/break-models/mars';
import type { Steps } from '../../../game/grouping/break-models/steps';
import { TERRA } from '../../../game/grouping/break-models/terra';
import type { Workings } from '../../../game/grouping/break-models/workings';
import {
  forAndAgainstView,
  judgedViews,
  nextRunView,
  ownBreak,
  paceView,
  zView,
} from './judged-views';
import { modelViews } from './model-views';
import type { Layer } from './plot';
import type { ViewInput } from './view-input';

describe('the views of a model that judges each run on its own', () => {
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

  function stepsOf(steps: Steps | undefined): Steps & { readonly workings: Workings } {
    if (steps?.workings === undefined) {
      throw new Error('No workings');
    }
    return { ...steps, workings: steps.workings };
  }

  const runs = [run(30), run(30), run(24)];
  const mars = stepsOf(MARS.steps?.({}, runs));
  const { workings } = mars;
  const pool = workings.pool ?? fail();

  function fail(): never {
    throw new Error('No pool');
  }

  function input(model: Steps = mars, picked: number[] = []): ViewInput {
    return { model, picked, aggregate: true, places: 30 };
  }

  function layer(layers: readonly Layer[], kind: Layer['kind'], role?: string): Layer | undefined {
    return layers.find((each) => each.kind === kind && (role === undefined || each.role === role));
  }

  it('shows how each run is judged, how the runs add up, and what comes of it, in order', () => {
    expect(modelViews(input()).map((plot) => plot.title)).toEqual([
      'Pace',
      'Unevenness',
      'z',
      'Trust',
      'Evidence',
      'For and against',
      'Log-odds',
      'Break probability',
      'Coverage',
      'Agreement',
      'Confidence',
      'Pause to break',
      'Group sizes',
    ]);
  });

  it('shows how each run is judged, but not how they add up, for a model that averages their verdicts', () => {
    const terra = stepsOf(TERRA.steps?.({}, runs));

    expect(judgedViews(input(terra), terra.workings).map((plot) => plot.title)).toEqual([
      'Pace',
      'Unevenness',
      'z',
      'Trust',
    ]);
  });

  it('marks in red the z where a run breaks on its own, against the z a lone run breaks at', () => {
    const layers = zView(input(), workings).layers;
    const breaks = layer(layers, 'dots', 'break');
    const expected = mars.runs.flatMap((_, k) =>
      (workings.runs[k]?.z ?? []).flatMap((z, i) =>
        z !== undefined && ownBreak(mars, k, i) ? [i] : [],
      ),
    );

    expect(breaks?.kind === 'dots' ? breaks.points.map(([i]) => i) : []).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
    expect(layers.some((each) => each.kind === 'hline' && each.y === workings.breakZ)).toBe(true);
  });

  it('draws the pace and its spread only for the runs picked', () => {
    expect(layer(paceView(input(), workings).layers, 'area')).toBeUndefined();
    expect(layer(paceView(input(mars, [1]), workings).layers, 'area')).toBeDefined();
  });

  it('adds up the evidence for and against to what takes the prior to the log-odds', () => {
    const sum = layer(forAndAgainstView(input(), workings, pool).layers, 'line', 'aggregate');
    const points = sum?.kind === 'line' ? sum.points : [];

    for (const at of [3, 14, 15]) {
      expect(points[at]?.[1]).toBeCloseTo((pool.logOdds[at] ?? NaN) - pool.prior, 9);
    }
  });

  it('shows the pause the next run needs to end its group at each place', () => {
    const line = layer(nextRunView(input(), workings, pool).layers, 'line', 'aggregate');

    expect(line?.kind === 'line' ? line.points[14]?.[1] : undefined).toBeCloseTo(
      pool.nextRunZ[14] ?? NaN,
      9,
    );
  });
});
