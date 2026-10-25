import { betaDensity } from '../../../game/grouping/break-models/statistics';
import type { Steps } from '../../../game/grouping/break-models/steps';
import type { PoolWorkings, Workings } from '../../../game/grouping/break-models/workings';
import { ownBreak, padded, weightedEvidence, weightOf } from './judged-views';
import { clamp, Plot, Point } from './plot';
import { format, intervalTicks, niceStep, stepTicks } from './view-input';

/**
 * What the break model makes of one place across the runs, as developer mode shows it: whether it's a break and by how
 * much, then, in the order the model works it out, what each run says there and how much it counts, what that adds up
 * to, how surely, and a table of every run. The place is an index of the steps: the boundary before digit `place`.
 */

/** What the place analysis is made of. */
export interface PlaceInput {
  readonly model: Steps;
  /** The index of the place: the boundary before that digit, from 1. */
  readonly place: number;
  /** The runs picked, by their index in the model's runs, which stand out. */
  readonly picked: readonly number[];
  /** What each run is called, by its index in the model's runs. */
  readonly titles: readonly string[];
}

/** A fact about the place: what it is, and its value as read. */
export interface Fact {
  readonly label: string;
  readonly value: string;
}

/** The runs at the place, one row each, and what each column holds. */
export interface PlaceTable {
  readonly columns: readonly string[];
  readonly rows: readonly {
    readonly run: number;
    readonly cells: readonly string[];
    readonly picked: boolean;
    readonly breaks: boolean;
  }[];
}

export interface PlaceAnalysis {
  /** Whether the place is a usual break spot, which ends a group there. */
  readonly breaks: boolean;
  readonly facts: readonly Fact[];
  readonly plots: readonly Plot[];
  readonly table: PlaceTable;
}

/** Everything the model makes of the place. */
export function placeAnalysis(input: PlaceInput): PlaceAnalysis {
  const { model, place } = input;
  const { workings } = model;
  const pool = workings?.pool;
  const usual = model.usual[place] ?? 0;
  return {
    breaks: usual > model.settings.usualThreshold,
    facts: [
      ...(workings === undefined || pool === undefined ? [] : poolFacts(input, workings, pool)),
      ...commonFacts(input),
    ],
    plots: [
      intervalsHere(input),
      ...(workings === undefined
        ? []
        : [zHere(input, workings), recencyOf(input, workings), weightHere(input, workings)]),
      ...(workings === undefined || pool === undefined ? [] : [waterfall(input, workings, pool)]),
      probabilityHere(input),
      rateHere(input),
    ],
    table: tableHere(input),
  };
}

/** The runs that reached the place, by their index. */
function runsHere({ model, place }: PlaceInput): number[] {
  return model.runs.flatMap((run, k) => (run.breakProbability[place] === undefined ? [] : [k]));
}

/** The x-axis of the plots across the runs: run k from k to k + 1, oldest first. */
function acrossRuns(model: Steps): Plot['x'] {
  return {
    min: 0,
    max: Math.max(1, model.runs.length),
    labels: ['Oldest run', 'Newest'],
    label: (x) => `Run ${String(Math.min(model.runs.length, Math.floor(x) + 1))}`,
  };
}

/** A percentage, to the nearest whole one, finer near the ends. */
function percent(value: number): string {
  const share = 100 * value;
  return share > 0 && share < 1
    ? '<1%'
    : share > 99 && share < 100
      ? '>99%'
      : `${String(Math.round(share))}%`;
}

/** A signed number, as read: its sign always shown. */
function signed(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${format(Math.abs(value))}`;
}

function milliseconds(value: number): string {
  return `${String(Math.round(value))} ms`;
}

/** The weight of the runs that break at the place on their own, and of all those that reached it. */
function rateOf({ model, place }: PlaceInput): {
  readonly breaks: number;
  readonly reached: number;
} {
  const reached = model.coverage[place] ?? 0;
  const agreement = model.workings?.pool?.agreement[place] ?? model.usual[place] ?? 0;
  return { breaks: agreement * reached, reached };
}

/**
 * How the evidence of the runs adds up at the place, with the group-size envelope's if it adds any, and what the next
 * run would need there.
 */
function poolFacts(input: PlaceInput, workings: Workings, pool: PoolWorkings): Fact[] {
  const { place, titles } = input;
  const envelope = pool.envelope[place] ?? 0;
  const logOdds = pool.logOdds[place] ?? pool.prior;
  const margin = logOdds + envelope - pool.threshold;
  const shares = workings.runs.map((run, k) => ({ k, value: weightedEvidence(run)[place] }));
  const given = shares.flatMap(({ k, value }) => (value === undefined ? [] : [{ k, value }]));
  const forBreak = given.reduce((sum, { value }) => sum + Math.max(0, value), 0);
  const against = given.reduce((sum, { value }) => sum + Math.min(0, value), 0);
  const most = (sign: 1 | -1): string => {
    const [top] = [...given].sort((a, b) => sign * (b.value - a.value));
    return top === undefined || sign * top.value <= 0
      ? 'none'
      : `${titles[top.k] ?? ''}, ${signed(top.value)}`;
  };
  const nextZ = pool.nextRunZ[place] ?? workings.breakZ;
  return [
    {
      label: 'Log-odds',
      value: Number.isFinite(margin)
        ? `${format(logOdds + envelope)}, ${format(Math.abs(margin))} ${margin > 0 ? 'over' : 'short of'} the threshold, ${format(pool.threshold)}`
        : `${margin > 0 ? 'over' : 'under'} the threshold, ${format(pool.threshold)}, whatever the runs say`,
    },
    ...(envelope === 0
      ? []
      : [
          {
            label: 'Envelope',
            value: Number.isFinite(envelope)
              ? `${signed(envelope)} on the runs’ ${format(logOdds)}, for the groups on either side`
              : `rules a break ${envelope > 0 ? 'in' : 'out'}, for the groups on either side`,
          },
        ]),
    {
      label: 'Evidence',
      value: `the prior ${format(pool.prior)}, ${signed(forBreak)} for a break, ${signed(against)} against`,
    },
    { label: 'Most for', value: most(1) },
    { label: 'Most against', value: most(-1) },
    {
      label: 'Next run',
      value:
        nextZ === Infinity
          ? 'never ends its group here, however long it pauses'
          : nextZ <= 0
            ? 'ends its group here even typing on fast'
            : `ends its group here pausing ${format(nextZ)} spreads over its pace: ×${format(Math.exp(nextZ * workings.spreadFloor))} its pace at least, at the spread floor`,
    },
  ];
}

/** What every model says of the place: how likely a break, how many runs, how surely. */
function commonFacts(input: PlaceInput): Fact[] {
  const { model, place } = input;
  const usual = model.usual[place] ?? 0;
  const { breaks, reached } = rateOf(input);
  const count = runsHere(input).length;
  const confidence = model.confidence[place];
  const trend = model.confidenceTrend[place];
  return [
    {
      label: 'Break probability',
      value: `${percent(usual)}, against ${percent(model.settings.usualThreshold)}`,
    },
    {
      label: 'Runs here',
      value: `${String(count)}, weighing ${format(reached)} in all, ${percent(reached > 0 ? breaks / reached : 0)} of it breaking here on its own`,
    },
    {
      label: 'Confidence',
      value:
        confidence === undefined
          ? 'none'
          : `${percent(confidence)}, its trend ${percent(trend ?? 0)}: ${place <= model.horizon ? 'within' : 'past'} the trust horizon`,
    },
  ];
}

/**
 * Each run's interval at the place, on a log scale, red where the run breaks there on its own, and the pace or
 * baseline it was judged against, give or take its spread where the model has one.
 */
function intervalsHere(input: PlaceInput): Plot {
  const { model, place } = input;
  const runs = runsHere(input);
  const judged = model.workings?.runs;
  const interval = (k: number): number | undefined => {
    const own = judged?.[k]?.logInterval[place];
    if (own !== undefined) {
      return own;
    }
    const baseline = model.runs[k]?.baseline[place];
    const residual = model.runs[k]?.residual[place];
    return baseline === undefined || residual === undefined
      ? undefined
      : Math.log(baseline) + residual;
  };
  const expected = (k: number): number | undefined => {
    const pace = judged?.[k]?.pace[place];
    const baseline = model.runs[k]?.baseline[place];
    return pace ?? (baseline === undefined ? undefined : Math.log(baseline));
  };
  const values = runs.flatMap((k) => [interval(k), expected(k)]).filter((v) => v !== undefined);
  const range = padded(values, { min: Math.log(20), max: Math.log(30_000) });
  const normal: Point[] = [];
  const breaks: Point[] = [];
  for (const k of runs) {
    const value = interval(k);
    if (value !== undefined) {
      (ownBreak(model, k, place) ? breaks : normal).push([k + 0.5, clamp(value, range)]);
    }
  }
  const around = (sign: number): (Point | undefined)[] =>
    runs.map((k) => {
      const pace = expected(k);
      const spread = judged?.[k]?.spread[place];
      return pace === undefined || spread === undefined
        ? undefined
        : [k + 0.5, clamp(pace + sign * spread, range)];
    });
  return {
    title: 'Intervals here',
    caption: `Each run’s interval here, on a log scale, against the ${judged === undefined ? 'baseline' : 'pace around it in its run'} it was judged by.`,
    x: acrossRuns(model),
    y: { ...range, ticks: intervalTicks() },
    legend: [
      { mark: 'dots', role: 'run', label: 'Interval' },
      { mark: 'dots', role: 'break', label: 'A break on its own' },
      { mark: 'line', role: 'faint', label: judged === undefined ? 'Baseline' : 'Pace' },
      ...(judged === undefined
        ? []
        : ([{ mark: 'area', role: 'faint', label: 'Give or take a spread' }] as const)),
    ],
    layers: [
      ...(judged === undefined
        ? []
        : [{ kind: 'area', upper: around(1), lower: around(-1), role: 'faint' } as const]),
      {
        kind: 'line',
        points: runs.map((k) => {
          const pace = expected(k);
          return pace === undefined ? undefined : ([k + 0.5, clamp(pace, range)] as const);
        }),
        role: 'faint',
      },
      { kind: 'dots', points: normal, role: 'run' },
      { kind: 'dots', points: breaks, role: 'break' },
    ],
  };
}

/** Each run's z at the place, against the z a lone run breaks at. */
function zHere(input: PlaceInput, workings: Workings): Plot {
  const { model, place } = input;
  const points = runsHere(input).flatMap((k) => {
    const z = workings.runs[k]?.z[place];
    return z === undefined ? [] : [{ k, z }];
  });
  const range = padded([0, workings.breakZ, ...points.map(({ z }) => z)], { min: -6, max: 15 });
  const dots = (breaks: boolean): Point[] =>
    points
      .filter(({ k }) => ownBreak(model, k, place) === breaks)
      .map(({ k, z }) => [k + 0.5, clamp(z, range)]);
  return {
    title: 'z here',
    caption: 'How many spreads each run’s interval here is above the pace around it in its run.',
    x: acrossRuns(model),
    y: { ...range, ticks: stepTicks(range.min, range.max, niceStep(range.max - range.min)) },
    legend: [
      { mark: 'dots', role: 'run', label: 'z' },
      { mark: 'dots', role: 'break', label: 'A break on its own' },
      { mark: 'line', role: 'faint', label: `No evidence, ${format(workings.evenZ)}` },
      { mark: 'line', role: 'break', label: `A lone run breaks, ${format(workings.breakZ)}` },
    ],
    layers: [
      { kind: 'hline', y: workings.evenZ, role: 'faint' },
      { kind: 'hline', y: workings.breakZ, role: 'break' },
      { kind: 'dots', points: dots(false), role: 'run' },
      { kind: 'dots', points: dots(true), role: 'break' },
    ],
  };
}

/** How much each run counts for its age, oldest to newest, at every place alike, the runs picked in red. */
function recencyOf(input: PlaceInput, workings: Workings): Plot {
  const { model } = input;
  const picked = new Set(input.picked);
  const all = workings.runs.map((_, k) => k);
  const bar = (k: number) => ({
    from: k + 0.1,
    to: k + 0.9,
    height: workings.runs[k]?.recency ?? 0,
  });
  return {
    title: 'Recency',
    caption:
      'How much each run counts for its age, oldest to newest, here as everywhere: its weight is this times its trust.',
    x: acrossRuns(model),
    y: { min: 0, max: 1.05, ticks: stepTicks(0, 1, 0.5) },
    legend: [
      { mark: 'bars', role: 'run', label: 'Recency' },
      { mark: 'bars', role: 'break', label: 'A run picked' },
    ],
    layers: [
      { kind: 'bars', bars: all.filter((k) => !picked.has(k)).map(bar), role: 'run' },
      { kind: 'bars', bars: all.filter((k) => picked.has(k)).map(bar), role: 'break' },
    ],
  };
}

/** How much each run counts at the place: its weight, its recency times its trust, under its recency alone. */
function weightHere(input: PlaceInput, workings: Workings): Plot {
  const { model, place } = input;
  const runs = runsHere(input);
  const picked = new Set(input.picked);
  const bar = (k: number) => {
    const run = workings.runs[k];
    return { from: k + 0.1, to: k + 0.9, height: run === undefined ? 0 : weightOf(run, place) };
  };
  return {
    title: 'Weight here',
    caption: 'How much each run counts here: its recency times its trust.',
    x: acrossRuns(model),
    y: { min: 0, max: 1.05, ticks: stepTicks(0, 1, 0.5) },
    legend: [
      { mark: 'bars', role: 'run', label: 'Weight' },
      { mark: 'bars', role: 'break', label: 'A run picked' },
      { mark: 'line', role: 'faint', label: 'Recency alone' },
    ],
    layers: [
      { kind: 'bars', bars: runs.filter((k) => !picked.has(k)).map(bar), role: 'run' },
      { kind: 'bars', bars: runs.filter((k) => picked.has(k)).map(bar), role: 'break' },
      {
        kind: 'line',
        points: runs.map((k) => [k + 0.5, workings.runs[k]?.recency ?? 0] as const),
        role: 'faint',
      },
    ],
  };
}

/**
 * How the log-odds at the place add up, run by run, oldest first: from the prior, each run's evidence times its weight,
 * up for a break (red) or down against it, to where they end, over the threshold or not.
 */
function waterfall(input: PlaceInput, workings: Workings, pool: PoolWorkings): Plot {
  const { model, place } = input;
  let total = pool.prior;
  const steps = runsHere(input).flatMap((k) => {
    const run = workings.runs[k];
    const value = run === undefined ? undefined : weightedEvidence(run)[place];
    if (value === undefined) {
      return [];
    }
    const base = total;
    total += value;
    return [{ k, base, height: total, up: value > 0 }];
  });
  const range = padded([0, pool.prior, pool.threshold, ...steps.map(({ height }) => height)], {
    min: -1000,
    max: 1000,
  });
  const bars = (up: boolean) =>
    steps
      .filter((step) => step.up === up)
      .map(({ k, base, height }) => ({ from: k + 0.1, to: k + 0.9, base, height }));
  return {
    title: 'Evidence here',
    caption: `The log-odds here, run by run, oldest first: from the prior, ${format(pool.prior)}, each run’s weighted evidence, to ${format(total)}.`,
    x: acrossRuns(model),
    y: { ...range, ticks: stepTicks(range.min, range.max, niceStep(range.max - range.min)) },
    legend: [
      { mark: 'bars', role: 'break', label: 'For a break' },
      { mark: 'bars', role: 'aggregate', label: 'Against' },
      { mark: 'line', role: 'faint', label: 'Running total' },
      { mark: 'line', role: 'break', label: `Threshold, ${format(pool.threshold)}` },
    ],
    layers: [
      { kind: 'hline', y: pool.threshold, role: 'break' },
      { kind: 'bars', bars: bars(false), role: 'aggregate' },
      { kind: 'bars', bars: bars(true), role: 'break' },
      {
        kind: 'line',
        points: steps.map(({ k, height }): Point => [k + 0.5, clamp(height, range)]),
        role: 'faint',
      },
    ],
  };
}

/** Each run's own P(break) at the place, against the break threshold, and the usual-break probability over them. */
function probabilityHere(input: PlaceInput): Plot {
  const { model, place } = input;
  const runs = runsHere(input);
  const dots = (breaks: boolean): Point[] =>
    runs
      .filter((k) => ownBreak(model, k, place) === breaks)
      .map((k) => [k + 0.5, model.runs[k]?.breakProbability[place] ?? 0]);
  return {
    title: 'P(break) here',
    caption:
      'How likely each run breaks here on its own, and the usual-break probability over them all.',
    x: acrossRuns(model),
    y: { min: 0, max: 1, ticks: stepTicks(0, 1, 0.5) },
    legend: [
      { mark: 'dots', role: 'run', label: 'P(break)' },
      { mark: 'dots', role: 'break', label: 'A break on its own' },
      { mark: 'line', role: 'break', label: 'Break threshold' },
      { mark: 'line', role: 'aggregate', label: 'Usual-break probability' },
    ],
    layers: [
      { kind: 'hline', y: model.settings.breakThreshold, role: 'break' },
      { kind: 'hline', y: model.usual[place] ?? 0, role: 'aggregate' },
      { kind: 'dots', points: dots(false), role: 'run' },
      { kind: 'dots', points: dots(true), role: 'break' },
    ],
  };
}

const RATE_POINTS = 100;

/**
 * How likely each break rate at the place is, given the weight of the runs that break there and of those that don't: the
 * confidence is the share of it on the verdict's side of the threshold (shaded).
 */
function rateHere(input: PlaceInput): Plot {
  const { model, place } = input;
  const { breaks, reached } = rateOf(input);
  const threshold = model.settings.usualThreshold;
  const breaksHere = (model.usual[place] ?? 0) > threshold;
  const xs = Array.from({ length: RATE_POINTS - 1 }, (_, i) => (i + 1) / RATE_POINTS);
  const density = xs.map((x) => betaDensity(x, 1 + breaks, 1 + reached - breaks));
  const top = Math.max(1, ...density.filter(Number.isFinite));
  const points = xs.map((x, i): Point => [x, Math.min(top, density[i] ?? 0)]);
  const side = points.map((point) => (point[0] > threshold === breaksHere ? point : undefined));
  return {
    title: 'Break rate here',
    caption: `How likely each share of the runs’ weight breaking here is, from the ${format(breaks)} of ${format(reached)} that do.`,
    x: { min: 0, max: 1, labels: ['None break', 'All do'] },
    y: { min: 0, max: top * 1.05 },
    legend: [
      { mark: 'line', role: 'aggregate', label: 'How likely' },
      {
        mark: 'area',
        role: breaksHere ? 'break' : 'faint',
        label: 'On the verdict’s side: the confidence',
      },
      { mark: 'line', role: 'break', label: `Threshold, ${format(threshold)}` },
    ],
    layers: [
      {
        kind: 'area',
        upper: side,
        lower: side.map((point) => (point === undefined ? undefined : [point[0], 0])),
        role: breaksHere ? 'break' : 'faint',
      },
      { kind: 'vline', x: threshold, role: 'break' },
      { kind: 'line', points, role: 'aggregate' },
    ],
  };
}

/**
 * Every run at the place, one row each: what it says there and how much it counts, the runs that weigh most first,
 * or, for a model that doesn't add the runs' evidence up, the newest first.
 */
function tableHere(input: PlaceInput): PlaceTable {
  const { model, place, titles } = input;
  const picked = new Set(input.picked);
  const runs = runsHere(input);
  const workings = model.workings;
  const probability = (k: number): string => percent(model.runs[k]?.breakProbability[place] ?? 0);
  if (workings === undefined) {
    return {
      columns: ['Run', 'Interval', 'Baseline', 'Residual', 'P(break)'],
      rows: [...runs].reverse().map((k) => {
        const baseline = model.runs[k]?.baseline[place];
        const residual = model.runs[k]?.residual[place];
        return {
          run: k,
          picked: picked.has(k),
          breaks: ownBreak(model, k, place),
          cells: [
            titles[k] ?? '',
            baseline === undefined || residual === undefined
              ? ''
              : milliseconds(baseline * Math.exp(residual)),
            baseline === undefined ? '' : milliseconds(baseline),
            residual === undefined ? '' : format(residual),
            probability(k),
          ],
        };
      }),
    };
  }
  const pooled = workings.pool !== undefined;
  const share = (k: number): number => {
    const run = workings.runs[k];
    return run === undefined ? 0 : (weightedEvidence(run)[place] ?? 0);
  };
  const ordered = pooled
    ? [...runs].sort((a, b) => Math.abs(share(b)) - Math.abs(share(a)))
    : [...runs].reverse();
  return {
    columns: [
      'Run',
      'Interval',
      'Pace',
      'z',
      'Trust',
      'Weight',
      ...(pooled ? ['Evidence'] : []),
      'P(break)',
    ],
    rows: ordered.map((k) => {
      const run = workings.runs[k];
      const logInterval = run?.logInterval[place];
      const pace = run?.pace[place];
      const z = run?.z[place];
      return {
        run: k,
        picked: picked.has(k),
        breaks: ownBreak(model, k, place),
        cells: [
          titles[k] ?? '',
          logInterval === undefined ? '' : milliseconds(Math.exp(logInterval)),
          pace === undefined ? '' : milliseconds(Math.exp(pace)),
          z === undefined ? '' : format(z),
          format(run?.trust[place] ?? 0),
          run === undefined ? '' : format(weightOf(run, place)),
          ...(pooled ? [signed(share(k))] : []),
          probability(k),
        ],
      };
    }),
  };
}
