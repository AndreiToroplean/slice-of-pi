import type { Values } from '../../../game/grouping/break-models/break-model';
import type { Steps } from '../../../game/grouping/break-models/steps';
import type {
  PoolWorkings,
  RunWorkings,
  Workings,
} from '../../../game/grouping/break-models/workings';
import { alongPlaces, clamp, Layer, Plot, Point, pointsOf, Range } from './plot';
import { format, intervalTicks, niceStep, runsShown, stepTicks, ViewInput } from './view-input';

/**
 * The views of a model that judges each run on its own against the intervals around each of its places (Terra, Mars),
 * from its workings (`workings.ts`), in the order it works them out: each run's pace and unevenness, its z, its trust,
 * then, for a model that adds the runs' evidence up, each run's share of it and what it adds up to;
 * and, after the steps every model has, how many runs agree, and the pause the next run needs to break.
 */

/** The views of each run judged, then of the pool, if the model adds the runs' evidence up. */
export function judgedViews(input: ViewInput, workings: Workings): Plot[] {
  return [
    paceView(input, workings),
    unevennessView(input, workings),
    zView(input, workings),
    trustView(input, workings),
    ...(workings.pool === undefined
      ? []
      : [
          evidenceView(input, workings),
          forAndAgainstView(input, workings, workings.pool),
          logOddsView(input, workings.pool),
        ]),
  ];
}

/** Whether run k breaks at index i on its own. */
export function ownBreak(model: Steps, k: number, i: number): boolean {
  return (model.runs[k]?.breakProbability[i] ?? 0) > model.settings.breakThreshold;
}

/** The points of run k's values, split by whether the run breaks there on its own. */
function splitByBreaks(model: Steps, k: number, values: Values, range: Range): [Point[], Point[]] {
  const normal: Point[] = [];
  const breaks: Point[] = [];
  values.forEach((value, i) => {
    if (value !== undefined) {
      (ownBreak(model, k, i) ? breaks : normal).push([i, clamp(value, range)]);
    }
  });
  return [normal, breaks];
}

/** The dots of the runs shown, at their values, red where they break on their own. */
function runDots(
  input: ViewInput,
  series: (run: RunWorkings) => Values,
  workings: Workings,
  range: Range,
): Layer[] {
  const { runs, role } = runsShown(input);
  const normal: Point[] = [];
  const breaks: Point[] = [];
  for (const k of runs) {
    const run = workings.runs[k];
    if (run !== undefined) {
      const [n, b] = splitByBreaks(input.model, k, series(run), range);
      normal.push(...n);
      breaks.push(...b);
    }
  }
  return [
    { kind: 'dots', points: normal, role },
    { kind: 'dots', points: breaks, role: 'break' },
  ];
}

/** The lines of the runs picked, at their values: none while all the runs are shown, as a cloud of dots instead. */
function pickedLines(
  input: ViewInput,
  series: (run: RunWorkings) => Values,
  workings: Workings,
): Layer[] {
  return input.picked.flatMap((k): Layer[] => {
    const run = workings.runs[k];
    return run === undefined ? [] : [{ kind: 'line', points: pointsOf(series(run)), role: 'run' }];
  });
}

/** The range of the values of the runs shown, between the quantiles that leave out the odd outlier, within `bounds`. */
function rangeShown(
  input: ViewInput,
  series: (run: RunWorkings) => Values,
  workings: Workings,
  bounds: Range,
  extra: readonly number[] = [],
): Range {
  const values = runsShown(input)
    .runs.flatMap((k) => series(workings.runs[k] ?? EMPTY_RUN))
    .filter((value) => value !== undefined)
    .sort((a, b) => a - b);
  const low = values[Math.floor(0.005 * (values.length - 1))];
  const high = values[Math.ceil(0.995 * (values.length - 1))];
  return padded(
    [...(low === undefined ? [] : [low]), ...(high === undefined ? [] : [high]), ...extra],
    bounds,
  );
}

/** Just wide enough for the values, with a margin, within `bounds`. */
export function padded(values: readonly number[], bounds: Range): Range {
  if (values.length === 0) {
    return bounds;
  }
  const low = Math.min(...values);
  const high = Math.max(...values);
  const margin = Math.max(high - low, 1e-6) * 0.05;
  return { min: Math.max(bounds.min, low - margin), max: Math.min(bounds.max, high + margin) };
}

const EMPTY_RUN: RunWorkings = {
  logInterval: [],
  pace: [],
  unevenness: [],
  spread: [],
  z: [],
  evidence: [],
  trust: [],
  recency: 0,
};

/** The weight of a run at index i: its recency times its trust there. */
export function weightOf(run: RunWorkings, i: number): number {
  return run.recency * (run.trust[i] ?? 0);
}

/** The run's weighted evidence at each index: what it adds to the log-odds there. */
export function weightedEvidence(run: RunWorkings): Values {
  return run.evidence.map((evidence, i) =>
    evidence === undefined ? undefined : weightOf(run, i) * evidence,
  );
}

/**
 * Each interval, on a log scale, against the pace of the intervals around it in its run, give or take their spread:
 * a break stands out of the band. With all the runs shown, the usual pace over them.
 */
export function paceView(input: ViewInput, workings: Workings): Plot {
  const range = rangeShown(input, (run) => run.logInterval, workings, {
    min: Math.log(20),
    max: Math.log(30_000),
  });
  const bands = input.picked.flatMap((k): Layer[] => {
    const run = workings.runs[k];
    if (run === undefined) {
      return [];
    }
    const around = (sign: number): (Point | undefined)[] =>
      run.pace.map((pace, i) => {
        const spread = run.spread[i];
        return pace === undefined || spread === undefined
          ? undefined
          : [i, clamp(pace + sign * spread, range)];
      });
    return [{ kind: 'area', upper: around(1), lower: around(-1), role: 'faint' }];
  });
  const usual: Layer[] =
    input.picked.length === 0 && input.aggregate
      ? [
          {
            kind: 'line',
            points: pointsOf(
              input.model.speedCurve.map((pace) =>
                pace === undefined ? undefined : Math.log(pace),
              ),
            ),
            role: 'aggregate',
          },
        ]
      : [];
  return {
    title: 'Pace',
    caption:
      'Each interval, on a log scale, against the pace around it in its run, give or take its spread (the band): breaks stand out.',
    x: alongPlaces(input.places),
    y: { ...range, ticks: intervalTicks() },
    layers: [
      ...bands,
      ...pickedLines(input, (run) => run.pace, workings),
      ...runDots(input, (run) => run.logInterval, workings, range),
      ...usual,
    ],
  };
}

/** How uneven each run is around each place, against the spread floor and the unevenness for full trust. */
export function unevennessView(input: ViewInput, workings: Workings): Plot {
  const range = rangeShown(input, (run) => run.unevenness, workings, { min: 0, max: 1.5 }, [
    0,
    workings.spreadFloor,
    workings.fullTrustUnevenness,
  ]);
  return {
    title: 'Unevenness',
    caption:
      'How uneven each run is around each place: its z is counted in at least the floor (faint), and from full trust (solid) on, it counts fully.',
    x: alongPlaces(input.places),
    y: { ...range, ticks: stepTicks(range.min, range.max, niceStep(range.max - range.min)) },
    layers: [
      { kind: 'hline', y: workings.spreadFloor, role: 'faint' },
      { kind: 'hline', y: workings.fullTrustUnevenness, role: 'aggregate' },
      ...pickedLines(input, (run) => run.unevenness, workings),
      ...runDots(input, (run) => run.unevenness, workings, range),
    ],
  };
}

/** How many spreads each interval is above its pace, against the z a lone run breaks at. */
export function zView(input: ViewInput, workings: Workings): Plot {
  const range = rangeShown(input, (run) => run.z, workings, { min: -5, max: 12 }, [
    0,
    workings.breakZ,
  ]);
  return {
    title: 'z',
    caption: `How many spreads each interval is above its pace: evidence for a break from ${format(workings.evenZ)} (faint), and a lone run breaks over ${format(workings.breakZ)} (red).`,
    x: alongPlaces(input.places),
    y: { ...range, ticks: stepTicks(range.min, range.max, niceStep(range.max - range.min)) },
    layers: [
      { kind: 'hline', y: 0, role: 'faint' },
      { kind: 'hline', y: workings.evenZ, role: 'faint' },
      { kind: 'hline', y: workings.breakZ, role: 'break' },
      ...runDots(input, (run) => run.z, workings, range),
    ],
  };
}

/** How much each run's verdict counts at each place besides its recency. */
export function trustView(input: ViewInput, workings: Workings): Plot {
  const range = { min: 0, max: 1 };
  return {
    title: 'Trust',
    caption:
      'How much each run counts at each place besides its recency, from 0 to 1: as much as it’s uneven around the place.',
    x: alongPlaces(input.places),
    y: { ...range, ticks: stepTicks(0, 1, 0.5) },
    layers: [
      ...pickedLines(input, (run) => run.trust, workings),
      ...runDots(input, (run) => run.trust, workings, range),
    ],
  };
}

/** What each run adds to the log-odds of a break at each place: its evidence times its weight. */
export function evidenceView(input: ViewInput, workings: Workings): Plot {
  const range = rangeShown(input, weightedEvidence, workings, { min: -10, max: 10 }, [0]);
  const { runs, role } = runsShown(input);
  const against: Point[] = [];
  const forBreak: Point[] = [];
  for (const k of runs) {
    weightedEvidence(workings.runs[k] ?? EMPTY_RUN).forEach((value, i) => {
      if (value !== undefined) {
        (value > 0 ? forBreak : against).push([i, clamp(value, range)]);
      }
    });
  }
  return {
    title: 'Evidence',
    caption:
      'What each run adds to the log-odds of a break at each place: its evidence times its recency and trust, red for a break.',
    x: alongPlaces(input.places),
    y: { ...range, ticks: stepTicks(range.min, range.max, niceStep(range.max - range.min)) },
    layers: [
      { kind: 'hline', y: 0, role: 'faint' },
      { kind: 'dots', points: against, role },
      { kind: 'dots', points: forBreak, role: 'break' },
    ],
  };
}

/**
 * The runs' evidence at each place added up: for a break, against it, and both, so that a place where they clash shows
 * apart from one where they hardly say anything.
 */
export function forAndAgainstView(input: ViewInput, workings: Workings, pool: PoolWorkings): Plot {
  const evidence = workings.runs.map(weightedEvidence);
  const sums = (sign: 1 | -1): Values =>
    pool.logOdds.map((_, i) => {
      let sum = 0;
      let reached = false;
      for (const run of evidence) {
        const value = run[i];
        if (value !== undefined) {
          reached = true;
          sum += Math.max(0, sign * value);
        }
      }
      return reached ? sign * sum : undefined;
    });
  const forBreak = sums(1);
  const against = sums(-1);
  const values = [...forBreak, ...against].filter((value) => value !== undefined);
  const range = padded([0, ...values], { min: -1000, max: 1000 });
  return {
    title: 'For and against',
    caption:
      'The runs’ evidence at each place added up: for a break (red), against (below 0), and their sum, from the prior to the log-odds.',
    x: alongPlaces(input.places),
    y: { ...range, ticks: stepTicks(range.min, range.max, niceStep(range.max - range.min)) },
    layers: input.aggregate
      ? [
          { kind: 'hline', y: 0, role: 'faint' },
          {
            kind: 'area',
            upper: pointsOf(forBreak),
            lower: pointsOf(forBreak.map((v) => (v === undefined ? undefined : 0))),
            role: 'break',
          },
          {
            kind: 'area',
            upper: pointsOf(against.map((v) => (v === undefined ? undefined : 0))),
            lower: pointsOf(against),
            role: 'faint',
          },
          { kind: 'line', points: pointsOf(forBreak), role: 'break' },
          { kind: 'line', points: pointsOf(against), role: 'run' },
          {
            kind: 'line',
            points: pointsOf(
              forBreak.map((v, i) => (v === undefined ? undefined : v + (against[i] ?? 0))),
            ),
            role: 'aggregate',
          },
        ]
      : [],
  };
}

/** How far the log-odds of a break are from the threshold at each place, near it: further ones are cut off. */
const LOG_ODDS_REACH = 12;

/** The log-odds of a break at each place, against the threshold: over it, the place is a break. */
export function logOddsView(input: ViewInput, pool: PoolWorkings): Plot {
  const range = { min: pool.threshold - LOG_ODDS_REACH, max: pool.threshold + LOG_ODDS_REACH };
  const over: Point[] = [];
  pool.logOdds.forEach((value, i) => {
    if (value !== undefined && value > pool.threshold) {
      over.push([i, clamp(value, range)]);
    }
  });
  return {
    title: 'Log-odds',
    caption: `The log-odds of a break at each place: the prior (faint) plus the runs’ evidence. Over ${format(pool.threshold)} (red), it’s a break. Cut off ${String(LOG_ODDS_REACH)} away.`,
    x: alongPlaces(input.places),
    y: { ...range, ticks: stepTicks(range.min, range.max, 5) },
    layers: input.aggregate
      ? [
          { kind: 'hline', y: pool.prior, role: 'faint' },
          { kind: 'hline', y: pool.threshold, role: 'break' },
          {
            kind: 'line',
            points: pointsOf(
              pool.logOdds.map((v) => (v === undefined ? undefined : clamp(v, range))),
            ),
            role: 'aggregate',
          },
          { kind: 'dots', points: over, role: 'break' },
        ]
      : [],
  };
}

/** The weighted share of the runs that break at each place on their own, which the confidence is about. */
export function agreementView(input: ViewInput, pool: PoolWorkings): Plot {
  const { breakThreshold } = input.model.settings;
  return {
    title: 'Agreement',
    caption: `The weighted share of the runs that break at each place on their own: the confidence is how surely it’s over or under ${format(breakThreshold)} (red).`,
    x: alongPlaces(input.places),
    y: { min: 0, max: 1, ticks: stepTicks(0, 1, 0.5) },
    layers: input.aggregate
      ? [
          { kind: 'hline', y: breakThreshold, role: 'break' },
          { kind: 'line', points: pointsOf(pool.agreement), role: 'aggregate' },
        ]
      : [],
  };
}

/** The pause the next run needs at each place to end its group there, in its spreads above its pace. */
export function nextRunView(input: ViewInput, workings: Workings, pool: PoolWorkings): Plot {
  const values = pool.nextRunZ.filter((value) => value !== undefined);
  const range = padded([0, workings.breakZ, ...values], { min: -8, max: 30 });
  return {
    title: 'Pause to break',
    caption: `How many spreads above its pace the next run must pause to end its group at each place: ${format(workings.breakZ)} (red) with no runs before, under 0 at once.`,
    x: alongPlaces(input.places),
    y: { ...range, ticks: stepTicks(range.min, range.max, niceStep(range.max - range.min)) },
    layers: input.aggregate
      ? [
          { kind: 'hline', y: 0, role: 'faint' },
          { kind: 'hline', y: workings.breakZ, role: 'break' },
          {
            kind: 'line',
            points: pointsOf(
              pool.nextRunZ.map((v) => (v === undefined ? undefined : clamp(v, range))),
            ),
            role: 'aggregate',
          },
        ]
      : [],
  };
}
