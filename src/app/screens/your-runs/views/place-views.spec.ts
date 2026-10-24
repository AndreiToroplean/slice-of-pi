import { MARS } from '../../../game/grouping/break-models/mars';
import {
  finishedRuns,
  mercury,
  MERCURY_DEFAULTS,
} from '../../../game/grouping/break-models/mercury';
import type { Steps } from '../../../game/grouping/break-models/steps';
import { weightedEvidence } from './judged-views';
import { placeAnalysis, PlaceInput } from './place-views';

describe('the analysis of a place', () => {
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
  const mars = stepsOf(MARS.steps?.({}, runs));

  function stepsOf(steps: Steps | undefined): Steps {
    if (steps === undefined) {
      throw new Error('No steps');
    }
    return steps;
  }

  function input(place: number, model: Steps = mars): PlaceInput {
    return { model, place, picked: [], titles: ['first', 'second', 'third'] };
  }

  function factOf(place: number, label: string): string | undefined {
    return placeAnalysis(input(place)).facts.find((fact) => fact.label === label)?.value;
  }

  it('tells whether the place is a break, and by how much', () => {
    expect(placeAnalysis(input(15)).breaks).toBe(true);
    expect(factOf(15, 'Log-odds')).toContain('over');
    expect(placeAnalysis(input(14)).breaks).toBe(false);
    expect(factOf(14, 'Log-odds')).toContain('short of');
  });

  it('tells how long a pause the next run needs to end its group at the place', () => {
    expect(factOf(15, 'Next run')).toContain('even typing on fast');
    expect(factOf(14, 'Next run')).toContain('spreads over its pace');
  });

  it('adds up the evidence of the runs, oldest first, from the prior to the log-odds', () => {
    const waterfall = placeAnalysis(input(14)).plots.find((plot) => plot.title === 'Evidence here');
    const line = waterfall?.layers.find((layer) => layer.kind === 'line');
    const points = line?.kind === 'line' ? line.points : [];

    expect(points.map((point) => point?.[0])).toEqual([0.5, 1.5, 2.5]);
    expect(points.at(-1)?.[1]).toBeCloseTo(mars.workings?.pool?.logOdds[14] ?? NaN, 9);
  });

  it('lists every run that reached the place, those that weigh most first', () => {
    const { table } = placeAnalysis(input(14));
    const shares = table.rows.map(({ run: k }) => {
      const judged = mars.workings?.runs[k];
      return judged === undefined ? NaN : Math.abs(weightedEvidence(judged)[14] ?? 0);
    });

    expect(table.rows.length).toBe(3);
    expect(shares).toEqual([...shares].sort((a, b) => b - a));
    expect(table.rows.every((row) => row.cells.length === table.columns.length)).toBe(true);
    // The third run is 24 digits long.
    expect(
      placeAnalysis(input(25))
        .table.rows.map((row) => row.run)
        .sort(),
    ).toEqual([0, 1]);
  });

  it('shades the break rates on the side of the verdict', () => {
    const shaded = (place: number): number[] => {
      const area = placeAnalysis(input(place))
        .plots.find((plot) => plot.title === 'Break rate here')
        ?.layers.find((layer) => layer.kind === 'area');
      return area?.kind === 'area'
        ? area.upper.flatMap((point) => (point === undefined ? [] : [point[0]]))
        : [];
    };
    const threshold = mars.settings.usualThreshold;

    expect(shaded(15).length).toBeGreaterThan(0);
    expect(shaded(15).every((x) => x > threshold)).toBe(true);
    expect(shaded(14).every((x) => x <= threshold)).toBe(true);
  });

  it('shows what a model that fits a mixture says of the place, without how it judged each run', () => {
    const model = mercury(finishedRuns(runs, MERCURY_DEFAULTS.window), undefined, MERCURY_DEFAULTS);
    const analysis = placeAnalysis(input(15, model));

    expect(analysis.plots.map((plot) => plot.title)).toEqual([
      'Intervals here',
      'P(break) here',
      'Break rate here',
    ]);
    expect(analysis.table.columns).toContain('Baseline');
    expect(analysis.facts.map((fact) => fact.label)).toEqual([
      'Break probability',
      'Runs here',
      'Confidence',
    ]);
  });
});
