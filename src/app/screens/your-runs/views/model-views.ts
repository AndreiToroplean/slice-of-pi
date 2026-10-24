import type { Values } from '../../../game/grouping/break-models/break-model';
import type { BreakSettings } from '../../../game/grouping/break-models/hyperparameters';
import {
  breakBoundary,
  Mixture,
  mixtureDensity,
} from '../../../game/grouping/break-models/statistics';
import { priorMixture, Steps } from '../../../game/grouping/break-models/steps';
import { alongPlaces, clamp, Layer, Plot, Point, pointsOf } from './plot';

/** What the views are made of: the steps of the model over the runs counted, and what of them to show. */
export interface ViewInput {
  readonly model: Steps;
  /** The runs picked, by their index in the model's runs. */
  readonly picked: readonly number[];
  /** Whether to show what the model makes of all the runs. */
  readonly aggregate: boolean;
  /** How many places the plots along the places span, as the charts of the times do. */
  readonly places: number;
  /** The settings to show on the charts, where they have a place. */
  readonly guides: ReadonlySet<string>;
}

/** The settings that can be shown on the charts, as lines where they act, each in its own color. */
export const GUIDE_COLORS: Partial<Record<keyof BreakSettings, string>> = {
  priorBaseline: '#2f80ed',
  priorBreakShare: '#9b51e0',
  priorBreakSize: '#e2731b',
  priorNormalSpread: '#1e9e6a',
  priorBreakSpread: '#c2185b',
  breakThreshold: '#d4a017',
  usualThreshold: '#0097a7',
  level: '#6d4c41',
};

/** A setting shown on a chart of times: its line, and its color. */
export interface TimeGuide {
  readonly series: Values;
  readonly color: string;
}

function colorOf(key: keyof BreakSettings): string {
  return GUIDE_COLORS[key] ?? 'currentColor';
}

/**
 * The settings shown on a chart of times, as lines over a baseline, in milliseconds: the prior baseline itself, the
 * prior's typical break, its normal intervals' spread above the baseline, and the time over which an interval is taken
 * for a break. Only a model that tells breaks by a mixture has them.
 */
export function timeGuides(
  baseline: Values,
  model: Steps | undefined,
  guides: ReadonlySet<string>,
): TimeGuide[] {
  if (model?.mixture === undefined) {
    return [];
  }
  const { settings } = model;
  const over = (residual: number): Values =>
    baseline.map((value) => (value === undefined ? undefined : value * Math.exp(residual)));
  const boundary = breakBoundary(model.mixture, settings.breakThreshold);
  const lines: [keyof BreakSettings, Values | undefined][] = [
    [
      'priorBaseline',
      baseline.map((value) => (value === undefined ? undefined : settings.priorBaseline)),
    ],
    ['priorBreakSize', over(Math.log(settings.priorBreakSize))],
    ['priorNormalSpread', over(settings.priorNormalSpread)],
    ['breakThreshold', boundary === undefined ? undefined : over(boundary)],
  ];
  return lines.flatMap(([key, series]) =>
    guides.has(key) && series !== undefined ? [{ series, color: colorOf(key) }] : [],
  );
}

/**
 * The settings shown among the residuals, as lines at the residuals they set, across `kind` lines. Only a model that
 * tells breaks by a mixture has them.
 */
function residualGuides({ model, guides }: ViewInput, kind: 'hline' | 'vline'): Layer[] {
  if (model.mixture === undefined) {
    return [];
  }
  const { settings } = model;
  const size = Math.log(settings.priorBreakSize);
  const boundary = breakBoundary(model.mixture, settings.breakThreshold);
  const lines: [keyof BreakSettings, readonly number[]][] = [
    ['priorBreakSize', [size]],
    ['priorNormalSpread', [-settings.priorNormalSpread, settings.priorNormalSpread]],
    ['priorBreakSpread', [size - settings.priorBreakSpread, size + settings.priorBreakSpread]],
    ['breakThreshold', boundary !== undefined && kind === 'hline' ? [boundary] : []],
  ];
  return lines.flatMap(([key, at]) =>
    guides.has(key)
      ? at.map((value) =>
          kind === 'hline'
            ? { kind, y: value, role: 'guide' as const, color: colorOf(key) }
            : { kind, x: value, role: 'guide' as const, color: colorOf(key) },
        )
      : [],
  );
}

/** The widest residuals shown, from the log of about a third of the baseline to twenty times it: farther ones are cut off. */
const RESIDUALS = { min: -1, max: 3 } as const;
const HISTOGRAM_BINS = 32;
const CURVE_POINTS = 80;

/** The steps of the break model after the times, in order, as plots: the mixture, if it fits one. */
export function modelViews(input: ViewInput): Plot[] {
  const { model } = input;
  return [
    residualView(input),
    ...(model.mixture === undefined ? [] : [mixtureView({ ...input, model })]),
    probabilityView(input),
    confidenceView(input),
  ];
}

/**
 * The runs whose intervals the views of residuals show: the runs picked, or all of them while none is but all of them
 * are shown.
 */
function residualRuns({ model, picked, aggregate }: ViewInput): readonly number[] {
  return picked.length > 0 || !aggregate ? picked : model.runs.map((_, k) => k);
}

/** The residuals of the runs shown. */
function residualsOf(input: ViewInput): number[] {
  return residualRuns(input).flatMap((k) =>
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
  const runs = residualRuns(input);
  const all = runs.length > 1 && input.picked.length === 0;
  const range = residualRange(input);
  const normal: Point[] = [];
  const breaks: Point[] = [];
  for (const k of runs) {
    const run = model.runs[k];
    run?.residual.forEach((residual, i) => {
      if (residual !== undefined) {
        const point = [i, clamp(residual, range)] as const;
        const { breakThreshold } = model.settings;
        ((run.breakProbability[i] ?? 0) > breakThreshold ? breaks : normal).push(point);
      }
    });
  }
  const fitted = aggregate && model.mixture !== undefined ? [model.mixture] : [];
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
    layers: [
      ...layers,
      ...residualGuides(input, 'hline'),
      { kind: 'dots', points: normal, role: all ? 'faint' : 'run' },
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
        ...(boundary === undefined ? [] : [{ kind: 'vline', x: boundary, role: 'break' } as const]),
      ]
    : [];
  const prior = priorMixture(settings);
  const priorCurve: Layer[] = input.guides.has('priorBreakShare')
    ? [
        {
          kind: 'line',
          points: xs.map((x) => {
            const [normal, pause] = mixtureDensity(prior, x);
            return [x, normal + pause];
          }),
          role: 'guide',
          color: colorOf('priorBreakShare'),
        },
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
      ...priorCurve,
      ...residualGuides(input, 'vline'),
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
    y: { min: 0, max: 1 },
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
      ...thresholdGuides(input, ['breakThreshold', 'usualThreshold']),
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
    y: { min: 0, max: 1 },
    layers: [...layers, ...thresholdGuides(input, ['level'])],
  };
}

/** The settings shown that are probabilities, as lines across a chart of probabilities. */
function thresholdGuides(
  { model, guides }: ViewInput,
  keys: readonly ('breakThreshold' | 'usualThreshold' | 'level')[],
): Layer[] {
  return keys
    .filter((key) => guides.has(key))
    .map((key) => ({ kind: 'hline', y: model.settings[key], role: 'guide', color: colorOf(key) }));
}
