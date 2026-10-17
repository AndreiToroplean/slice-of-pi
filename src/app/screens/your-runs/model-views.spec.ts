import type { BreakSettings } from '../../game/grouping/break-models/hyperparameters';
import { finishedRuns, mercury, MERCURY_DEFAULTS } from '../../game/grouping/break-models/mercury';
import { breakBoundary } from '../../game/grouping/break-models/statistics';
import {
  confidenceView,
  Layer,
  mixtureView,
  modelViews,
  probabilityView,
  residualView,
  timeGuides,
  ViewInput,
} from './model-views';

describe('the views of the break model', () => {
  const settings = MERCURY_DEFAULTS;

  /** The times of a run typed about 200 ms apart, pausing 700 ms before every third digit, a little differently each run. */
  function run(digits: number, seed: number): number[] {
    let time = 0;
    return Array.from({ length: digits }, (_, i) => {
      if (i > 0) {
        time += i % 3 === 0 ? 700 + seed * 10 : ([180, 200, 230][(i + seed) % 3] ?? 0);
      }
      return time;
    });
  }

  const runs = [run(30, 0), run(30, 1), run(24, 2)];
  const model = mercury(finishedRuns(runs, settings.window), undefined, settings);

  function input(
    picked: number[] = [],
    aggregate = true,
    guides: (keyof BreakSettings)[] = [],
  ): ViewInput {
    return { model, picked, aggregate, places: 30, settings, guides: new Set(guides) };
  }

  function guideLines(layers: readonly Layer[]): number[] {
    return layers.flatMap((layer) =>
      layer.role !== 'guide'
        ? []
        : layer.kind === 'hline'
          ? [layer.y]
          : layer.kind === 'vline'
            ? [layer.x]
            : [NaN],
    );
  }

  function dots(layers: readonly Layer[], role?: string): number {
    return layers
      .filter((layer) => layer.kind === 'dots' && (role === undefined || layer.role === role))
      .reduce((count, layer) => count + (layer.kind === 'dots' ? layer.points.length : 0), 0);
  }

  it('shows the steps after the times, in order', () => {
    expect(modelViews(input()).map((plot) => plot.title)).toEqual([
      'Residuals',
      'Mixture',
      'Break probability',
      'Confidence',
    ]);
  });

  it('shows the residuals of all the runs while none is picked, else of those picked', () => {
    expect(dots(residualView(input()).layers)).toBe(29 + 29 + 23);
    expect(dots(residualView(input([2])).layers)).toBe(23);
  });

  it('spans just the residuals shown and the mixture, within limits', () => {
    const residuals = model.runs.flatMap((found) =>
      found.residual.filter((residual) => residual !== undefined),
    );
    const { y } = residualView(input());

    expect(y.max).toBeGreaterThanOrEqual(Math.max(...residuals));
    expect(y.min).toBeLessThanOrEqual(Math.min(...residuals));
    expect(y.max).toBeLessThan(3);
    expect(mixtureView(input()).x).toMatchObject({ min: y.min, max: y.max });
  });

  it('marks in red the residuals taken for breaks', () => {
    expect(dots(residualView(input([0])).layers, 'break')).toBe(9);
  });

  it('draws the fitted mixture only with all the runs shown', () => {
    const lines = (aggregate: boolean): number =>
      mixtureView(input([0], aggregate)).layers.filter((layer) => layer.kind !== 'bars').length;

    expect(lines(true)).toBeGreaterThan(0);
    expect(lines(false)).toBe(0);
    expect(residualView(input([0], false)).layers.every((layer) => layer.kind === 'dots')).toBe(
      true,
    );
  });

  it('spreads the residuals as a histogram of their density, cut at the break boundary', () => {
    const plot = mixtureView(input());
    const bars = plot.layers.find((layer) => layer.kind === 'bars');
    const area =
      bars?.kind === 'bars'
        ? bars.bars.reduce((sum, bar) => sum + bar.height * (bar.to - bar.from), 0)
        : 0;

    expect(area).toBeCloseTo(1, 6);
    expect(plot.layers).toContainEqual({
      kind: 'vline',
      x: breakBoundary(model.mixture, settings.breakThreshold),
      role: 'break',
    });
  });

  it('shows the usual-break probability, and P(break) in the runs picked', () => {
    const plot = probabilityView(input([1]));

    expect(dots(plot.layers, 'run')).toBe(29);
    expect(plot.layers.filter((layer) => layer.role === 'aggregate')).toHaveLength(1);
  });

  it('cuts the confidence trend at the trust horizon', () => {
    expect(confidenceView(input()).layers).toContainEqual({
      kind: 'vline',
      x: model.horizon + 0.5,
      role: 'break',
    });
    expect(confidenceView(input([0], false)).layers).toEqual([]);
  });

  describe('the settings shown on the charts', () => {
    it('shows none unless told to', () => {
      expect(modelViews(input()).flatMap((plot) => guideLines(plot.layers))).toEqual([]);
      expect(timeGuides([undefined, 200], model, new Set())).toEqual([]);
    });

    it('draws the prior baseline, typical break, normal spread and break boundary over a baseline of times', () => {
      const boundary = breakBoundary(model.mixture, settings.breakThreshold) ?? 0;
      const guides = timeGuides(
        [undefined, 200],
        model,
        new Set(['priorBaseline', 'priorBreakSize', 'priorNormalSpread', 'breakThreshold']),
      );

      expect(guides.map(({ series }) => series[0])).toEqual([
        undefined,
        undefined,
        undefined,
        undefined,
      ]);
      expect(new Set(guides.map(({ color }) => color)).size).toBe(4);
      expect(guides.map(({ series }) => series[1] ?? 0)).toEqual([
        300,
        500,
        expect.closeTo(200 * Math.exp(0.25), 6),
        expect.closeTo(200 * Math.exp(boundary), 6),
      ]);
    });

    it('draws the prior mixture among the residuals', () => {
      const size = Math.log(settings.priorBreakSize);

      expect(
        guideLines(residualView(input([], true, ['priorBreakSize', 'priorBreakSpread'])).layers),
      ).toEqual([size, size - 0.4, size + 0.4]);
      expect(
        mixtureView(input([], true, ['priorBreakShare'])).layers.filter(
          (layer) => layer.role === 'guide' && layer.kind === 'line',
        ),
      ).toHaveLength(1);
    });

    it('draws the thresholds and the level across the probabilities', () => {
      expect(
        guideLines(probabilityView(input([], true, ['breakThreshold', 'usualThreshold'])).layers),
      ).toEqual([settings.breakThreshold, settings.usualThreshold]);
      expect(guideLines(confidenceView(input([], true, ['level'])).layers)).toEqual([
        settings.level,
      ]);
    });
  });
});
