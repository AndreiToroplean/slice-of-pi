import {
  breakBoundary,
  BreakModel,
  BreakSettings,
  mixtureDensity,
  Values,
} from '../timing/break-model';

/** A point of a plot, in its own units. */
export type Point = readonly [x: number, y: number];

/**
 * What a mark stands for, which sets how it's drawn: what the break model makes of all the runs stands out, the runs
 * picked are thinner, breaks are red, and what only helps reading is faint.
 */
export type Role = 'aggregate' | 'run' | 'break' | 'faint';

/** One kind of mark on a plot. */
export type Layer =
  | { readonly kind: 'line'; readonly points: readonly (Point | undefined)[]; readonly role: Role }
  | { readonly kind: 'dots'; readonly points: readonly Point[]; readonly role: Role }
  | { readonly kind: 'hline'; readonly y: number; readonly role: Role }
  | { readonly kind: 'vline'; readonly x: number; readonly role: Role }
  | { readonly kind: 'band'; readonly from: number; readonly to: number; readonly role: Role }
  | {
      readonly kind: 'bars';
      readonly bars: readonly {
        readonly from: number;
        readonly to: number;
        readonly height: number;
      }[];
      readonly role: Role;
    };

/** A plot of one step of the break model: what it shows, its ranges, and its marks, the first drawn first. */
export interface Plot {
  readonly title: string;
  readonly caption: string;
  readonly x: {
    readonly min: number;
    readonly max: number;
    readonly labels: readonly [string, string];
  };
  readonly y: { readonly min: number; readonly max: number };
  readonly layers: readonly Layer[];
}

/** What the views are made of: the model of the runs counted, and what of it to show. */
export interface ViewInput {
  readonly model: BreakModel;
  /** The runs picked, by their index in the model's runs. */
  readonly picked: readonly number[];
  /** Whether to show what the model makes of all the runs. */
  readonly aggregate: boolean;
  /** How many places the plots along the places span, as the charts of the times do. */
  readonly places: number;
  readonly settings: BreakSettings;
}

/** The widest residuals shown, from the log of about a third of the baseline to twenty times it: farther ones are cut off. */
const RESIDUALS = { min: -1, max: 3 } as const;
const HISTOGRAM_BINS = 32;
const CURVE_POINTS = 80;

/** The steps of the break model after the times, in order, as plots. */
export function modelViews(input: ViewInput): Plot[] {
  return [residualView(input), mixtureView(input), probabilityView(input), confidenceView(input)];
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
 * kinds of intervals, so that they spread over the chart; within {@link RESIDUALS}.
 */
function residualRange(input: ViewInput): { readonly min: number; readonly max: number } {
  const { mean, sd } = input.model.mixture;
  const values = [
    ...residualsOf(input),
    ...(input.aggregate ? [mean[0] - 2 * sd[0], mean[1] + 2 * sd[1]] : []),
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

function alongPlaces(places: number): Plot['x'] {
  return { min: 0, max: Math.max(places - 1, 1), labels: ['Place 1', `Place ${String(places)}`] };
}

function clamp(
  value: number,
  { min, max }: { readonly min: number; readonly max: number },
): number {
  return Math.min(max, Math.max(min, value));
}

/** The points of values by index, at their places. */
function pointsOf(values: Values): (Point | undefined)[] {
  return values.map((value, i) => (value === undefined ? undefined : ([i, value] as const)));
}

/**
 * Step 3: each interval's residual, the log of its interval over its baseline, along the places. Normal intervals sit
 * around the normal mean, breaks above, red where they're taken for breaks.
 */
export function residualView(input: ViewInput): Plot {
  const { model, aggregate, settings } = input;
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
        ((run.breakProbability[i] ?? 0) > settings.breakThreshold ? breaks : normal).push(point);
      }
    });
  }
  const { mean, sd } = model.mixture;
  const layers: Layer[] = aggregate
    ? [
        { kind: 'band', from: mean[0] - sd[0], to: mean[0] + sd[0], role: 'faint' },
        { kind: 'band', from: mean[1] - sd[1], to: mean[1] + sd[1], role: 'faint' },
        { kind: 'hline', y: mean[0], role: 'aggregate' },
        { kind: 'hline', y: mean[1], role: 'break' },
      ]
    : [];
  return {
    title: 'Residuals',
    caption: 'Each interval over its baseline, on a log scale: normal ones near 0, breaks above.',
    x: alongPlaces(input.places),
    y: range,
    layers: [
      ...layers,
      { kind: 'dots', points: normal, role: all ? 'faint' : 'run' },
      { kind: 'dots', points: breaks, role: 'break' },
    ],
  };
}

/**
 * Step 4: how the residuals spread, as a histogram, and the mixture fitted to them: the normal intervals, the breaks,
 * both together, and the residual over which an interval is taken for a break.
 */
export function mixtureView(input: ViewInput): Plot {
  const { model, aggregate, settings } = input;
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
    layers,
  };
}
