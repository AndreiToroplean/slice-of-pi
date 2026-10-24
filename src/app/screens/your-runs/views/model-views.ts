import {
  breakBoundary,
  Mixture,
  mixtureDensity,
} from '../../../game/grouping/break-models/statistics';
import type { Steps } from '../../../game/grouping/break-models/steps';
import { agreementView, judgedViews, nextRunView, ownBreak } from './judged-views';
import { alongPlaces, clamp, Layer, Plot, Point, pointsOf } from './plot';
import { niceStep, runsShown, stepTicks, ViewInput } from './view-input';

/** The thresholds and the level, each dashed in its own color where it's drawn, so that they tell apart. */
export const THRESHOLD_COLORS = {
  breakThreshold: '#d4a017',
  usualThreshold: '#0097a7',
  level: '#6d4c41',
} as const;

/** A threshold or the level as a dashed line across a plot of probabilities, at its value. */
function thresholdLine(model: Steps, key: keyof typeof THRESHOLD_COLORS): Layer {
  return { kind: 'hline', y: model.settings[key], role: 'guide', color: THRESHOLD_COLORS[key] };
}

/** The widest residuals shown, from the log of about a third of the baseline to twenty times it: farther ones are cut off. */
const RESIDUALS = { min: -1, max: 3 } as const;
const HISTOGRAM_BINS = 32;
const CURVE_POINTS = 80;

/**
 * The steps of the break model after the times, along the places, in the order it works them out, as plots: how it
 * judges the runs, then what it makes of them all.
 */
export function modelViews(input: ViewInput): Plot[] {
  const { model } = input;
  const { workings } = model;
  const pool = workings?.pool;
  return [
    ...(workings === undefined ? [residualView(input)] : judgedViews(input, workings)),
    ...(model.mixture === undefined ? [] : [mixtureView({ ...input, model })]),
    probabilityView(input),
    coverageView(input),
    ...(pool === undefined ? [] : [agreementView(input, pool)]),
    confidenceView(input),
    ...(workings === undefined || pool === undefined ? [] : [nextRunView(input, workings, pool)]),
  ];
}

/** The residuals of the runs shown. */
function residualsOf(input: ViewInput): number[] {
  return runsShown(input).runs.flatMap((k) =>
    (input.model.runs[k]?.residual ?? []).filter((residual) => residual !== undefined),
  );
}

/**
 * The range of residuals shown: just wide enough for the residuals and, with all the runs shown, the mixture's two
 * kinds of intervals, if any, so that they spread over the chart; within {@link RESIDUALS}.
 */
function residualRange(input: ViewInput): { readonly min: number; readonly max: number } {
  const { mixture } = input.model;
  const values = [
    ...residualsOf(input),
    ...(input.aggregate && mixture !== undefined
      ? [mixture.mean[0] - 2 * mixture.sd[0], mixture.mean[1] + 2 * mixture.sd[1]]
      : []),
  ];
  const low = Math.min(0, ...values);
  const high = Math.max(0.5, ...values);
  const margin = (high - low) * 0.05;
  return clampRange({ min: low - margin, max: high + margin });
}

function clampRange({ min, max }: { readonly min: number; readonly max: number }): {
  readonly min: number;
  readonly max: number;
} {
  return { min: Math.max(RESIDUALS.min, min), max: Math.min(RESIDUALS.max, max) };
}

/**
 * Step 3: each interval's residual, the log of its interval over its baseline, along the places. Normal intervals sit
 * around the normal mean, breaks above, red where they're taken for breaks.
 */
export function residualView(input: ViewInput): Plot {
  const { model, aggregate } = input;
  const { runs, role } = runsShown(input);
  const range = residualRange(input);
  const normal: Point[] = [];
  const breaks: Point[] = [];
  for (const k of runs) {
    const run = model.runs[k];
    run?.residual.forEach((residual, i) => {
      if (residual !== undefined) {
        const point = [i, clamp(residual, range)] as const;
        (ownBreak(model, k, i) ? breaks : normal).push(point);
      }
    });
  }
  const fitted = aggregate && model.mixture !== undefined ? [model.mixture] : [];
  const boundary =
    model.mixture === undefined
      ? undefined
      : breakBoundary(model.mixture, model.settings.breakThreshold);
  const layers = fitted.flatMap(({ mean, sd }): Layer[] => [
    { kind: 'band', from: mean[0] - sd[0], to: mean[0] + sd[0], role: 'faint' },
    { kind: 'band', from: mean[1] - sd[1], to: mean[1] + sd[1], role: 'faint' },
    { kind: 'hline', y: mean[0], role: 'aggregate' },
    { kind: 'hline', y: mean[1], role: 'break' },
  ]);
  return {
    title: 'Residuals',
    caption: 'Each interval over its baseline, on a log scale: normal ones near 0, breaks above.',
    x: alongPlaces(input.places),
    y: range,
    legend: [
      { mark: 'dots', role, label: 'Interval' },
      { mark: 'dots', role: 'break', label: 'Taken for a break' },
      ...(fitted.length > 0
        ? ([
            { mark: 'line', role: 'aggregate', label: 'Normal mean' },
            { mark: 'line', role: 'break', label: 'Break mean' },
            { mark: 'area', role: 'faint', label: 'Give or take a spread' },
          ] as const)
        : []),
      {
        mark: 'line',
        role: 'guide',
        color: THRESHOLD_COLORS.breakThreshold,
        label: 'Break boundary',
      },
    ],
    layers: [
      ...layers,
      ...(boundary === undefined
        ? []
        : [
            {
              kind: 'hline',
              y: boundary,
              role: 'guide',
              color: THRESHOLD_COLORS.breakThreshold,
            } as const,
          ]),
      { kind: 'dots', points: normal, role },
      { kind: 'dots', points: breaks, role: 'break' },
    ],
  };
}

/**
 * Step 4: how the residuals spread, as a histogram, and the mixture fitted to them: the normal intervals, the breaks,
 * both together, and the residual over which an interval is taken for a break.
 */
export function mixtureView(
  input: ViewInput & { readonly model: Extract<Steps, { readonly mixture: Mixture }> },
): Plot {
  const { model, aggregate } = input;
  const { settings } = model;
  const residuals = residualsOf(input);
  const range = residualRange(input);
  const width = (range.max - range.min) / HISTOGRAM_BINS;
  const counts = new Array<number>(HISTOGRAM_BINS).fill(0);
  for (const residual of residuals) {
    const bin = Math.min(
      HISTOGRAM_BINS - 1,
      Math.max(0, Math.floor((residual - range.min) / width)),
    );
    counts[bin] = (counts[bin] ?? 0) + 1;
  }
  const density = counts.map((count) => count / Math.max(1, residuals.length) / width);
  const xs = Array.from(
    { length: CURVE_POINTS + 1 },
    (_, i) => range.min + ((range.max - range.min) * i) / CURVE_POINTS,
  );
  const components = xs.map((x) => mixtureDensity(model.mixture, x));
  const boundary = breakBoundary(model.mixture, settings.breakThreshold);
  const curves: Layer[] = aggregate
    ? [
        { kind: 'line', points: xs.map((x, i) => [x, components[i]?.[0] ?? 0]), role: 'faint' },
        { kind: 'line', points: xs.map((x, i) => [x, components[i]?.[1] ?? 0]), role: 'break' },
        {
          kind: 'line',
          points: xs.map((x, i) => [x, (components[i]?.[0] ?? 0) + (components[i]?.[1] ?? 0)]),
          role: 'aggregate',
        },
        ...(boundary === undefined
          ? []
          : [
              {
                kind: 'vline',
                x: boundary,
                role: 'guide',
                color: THRESHOLD_COLORS.breakThreshold,
              } as const,
            ]),
      ]
    : [];
  const top = Math.max(
    0.1,
    ...density,
    ...(aggregate ? components.map(([normal, pause]) => normal + pause) : []),
  );
  return {
    title: 'Mixture',
    caption: 'How the residuals spread, and the two kinds of intervals fitted to them.',
    x: {
      min: range.min,
      max: range.max,
      labels: [`×${times(range.min)} baseline`, `×${times(range.max)}`],
    },
    y: { min: 0, max: top * 1.1 },
    legend: [
      { mark: 'bars', role: 'run', label: 'Residuals' },
      ...(aggregate
        ? ([
            { mark: 'line', role: 'faint', label: 'Normal' },
            { mark: 'line', role: 'break', label: 'Breaks' },
            { mark: 'line', role: 'aggregate', label: 'Both' },
            {
              mark: 'line',
              role: 'guide',
              color: THRESHOLD_COLORS.breakThreshold,
              label: 'Break boundary',
            },
          ] as const)
        : []),
    ],
    layers: [
      {
        kind: 'bars',
        bars: density.map((height, bin) => ({
          from: range.min + bin * width,
          to: range.min + (bin + 1) * width,
          height,
        })),
        role: 'run',
      },
      ...curves,
    ],
  };
}

/** How many times the baseline a residual is, rounded. */
function times(residual: number): string {
  return String(Number(Math.exp(residual).toPrecision(2)));
}

/** Step 6: the usual-break probability at each place, over all the runs, and P(break) in the runs picked. */
export function probabilityView(input: ViewInput): Plot {
  const { model, aggregate, picked } = input;
  return {
    title: 'Break probability',
    caption: 'How likely a break is before each place: over all runs, and in each run picked.',
    x: alongPlaces(input.places),
    y: { min: 0, max: 1, ticks: stepTicks(0, 1, 0.5) },
    legend: [
      { mark: 'line', role: 'aggregate', label: 'Over all runs' },
      { mark: 'dots', role: 'run', label: 'Each run picked' },
      {
        mark: 'line',
        role: 'guide',
        color: THRESHOLD_COLORS.breakThreshold,
        label: 'Break threshold',
      },
      {
        mark: 'line',
        role: 'guide',
        color: THRESHOLD_COLORS.usualThreshold,
        label: 'Usual threshold',
      },
    ],
    layers: [
      ...picked.map((k): Layer => ({
        kind: 'dots',
        points: pointsOf(model.runs[k]?.breakProbability ?? []).filter(
          (point) => point !== undefined,
        ),
        role: 'run',
      })),
      ...(aggregate
        ? [{ kind: 'line', points: pointsOf(model.usual), role: 'aggregate' } as const]
        : []),
      thresholdLine(model, 'breakThreshold'),
      thresholdLine(model, 'usualThreshold'),
    ],
  };
}

/** Step 7: how likely the verdict at each place is right, its trend, and the trust horizon where it drops too low. */
export function confidenceView(input: ViewInput): Plot {
  const { model, aggregate } = input;
  const layers: Layer[] = aggregate
    ? [
        {
          kind: 'dots',
          points: pointsOf(model.confidence).filter((point) => point !== undefined),
          role: 'faint',
        },
        { kind: 'line', points: pointsOf(model.confidenceTrend), role: 'aggregate' },
        { kind: 'vline', x: model.horizon + 0.5, role: 'break' },
      ]
    : [];
  return {
    title: 'Confidence',
    caption: 'How sure the verdict before each place is, and its trend, cut at the trust horizon.',
    x: alongPlaces(input.places),
    y: { min: 0, max: 1, ticks: stepTicks(0, 1, 0.5) },
    legend: [
      { mark: 'dots', role: 'faint', label: 'Confidence' },
      { mark: 'line', role: 'aggregate', label: 'Its trend' },
      { mark: 'line', role: 'break', label: 'Trust horizon' },
      { mark: 'line', role: 'guide', color: THRESHOLD_COLORS.level, label: 'Level' },
    ],
    layers: [...layers, thresholdLine(model, 'level')],
  };
}

/** How much weight the runs that reached each place carry, which the confidence there rests on. */
export function coverageView(input: ViewInput): Plot {
  const { model, aggregate } = input;
  const top = Math.max(1, ...model.coverage.filter((value) => value !== undefined));
  return {
    title: 'Coverage',
    caption:
      model.workings === undefined
        ? 'How much weight the runs that reached each place carry, synthetic ones included.'
        : 'How much weight the runs that reached each place carry: each its recency times its trust there.',
    x: alongPlaces(input.places),
    y: { min: 0, max: top * 1.05, ticks: stepTicks(0, top, niceStep(top)) },
    legend: [{ mark: 'line', role: 'aggregate', label: 'Weight of the runs here' }],
    layers: aggregate
      ? [{ kind: 'line', points: pointsOf(model.coverage), role: 'aggregate' }]
      : [],
  };
}
