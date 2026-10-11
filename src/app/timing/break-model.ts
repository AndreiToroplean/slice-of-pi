/**
 * The break model (`groupings.md` §4): classifies the intervals of the player's runs as breaks or not, with a
 * probability, finds where in π this player usually breaks, and up to which place those conclusions can be trusted.
 *
 * 1. It works in log(interval), since breaks are multiplicative: "x% slower than usual".
 * 2. Each run has a baseline, its expected log-interval at each place without the breaks. A finished run's is a
 *    centered rolling median along the places. The run in progress uses only what has been typed so far: the historical
 *    speed curve (the recency-weighted mean of the finished runs' baselines) plus this run's own offset from it, a
 *    trailing rolling median; past the end of all history, a trailing rolling median of the run itself. The baseline is
 *    smooth along the places on purpose: a median at each place across runs would absorb breaks the player makes at
 *    the same place every time.
 * 3. The residual of an interval is its log minus the baseline.
 * 4. A mixture of two normal distributions (normal and break) is fitted to all the residuals pooled, each weighted by
 *    its run's recency weight, by weighted EM (expectation–maximization).
 * 5. P(break) is the posterior probability of the break component, 0 below the normal mean: a break is never faster.
 * 6. The usual-break probability at a place is the recency-weighted average of P(break) over the runs that reached it.
 *    The usual break spots are the places where it's over ½.
 * 7. The confidence at a place is the probability that its verdict (usual break or not) is right, from a Beta
 *    posterior over the place's break rate. It drops as fewer runs reach a place and as they disagree, but it's noisy,
 *    so a non-increasing curve is fitted to it (isotonic regression), the confidence trend. That crosses the required
 *    level once: the trust horizon.
 *
 * Nothing here is stored; it's always computed from the times of the runs. Places are indexed like the digits of a
 * run: index 0 is the first digit typed. The interval at index i is the time from digit i - 1 to digit i, and the
 * verdict there is about the boundary just before digit i, so index 0 never has one.
 */

/** The hyperparameters of the model, to be tuned by play testing. */
export interface BreakSettings {
  /** The rolling-median window for the baseline, in intervals. */
  readonly window: number;
  /** A run's weight is `recencyDecay ** age`, age 0 being the newest run: 1 counts every run the same. */
  readonly recencyDecay: number;
  /** The confidence required for the trust horizon, from 0 to 1. */
  readonly level: number;
}

export const DEFAULT_BREAK_SETTINGS: BreakSettings = { window: 21, recencyDecay: 0.9, level: 0.9 };

/** The fitted mixture: component 0 is normal intervals, component 1 breaks. */
export interface Mixture {
  readonly weight: readonly [number, number];
  readonly mean: readonly [number, number];
  readonly sd: readonly [number, number];
}

/** Values by index; `undefined` where there's none. */
export type Values = readonly (number | undefined)[];

/** What the model makes of one run. */
export interface RunBreaks {
  /** The baseline at each index: the interval expected there without a break, in milliseconds. */
  readonly baseline: Values;
  /** P(break) at each index, from 0 to 1; none until there's enough data to fit the mixture. */
  readonly breakProbability: Values;
}

/** A group of digits cut by the usual break spots. */
export interface Group {
  /** The index of its first digit. */
  readonly start: number;
  readonly size: number;
  /** Whether it runs to the end of the data, with no break known to end it. */
  readonly open: boolean;
  /** Whether the break that ends it is within the trust horizon, and so every verdict that makes it. */
  readonly trusted: boolean;
}

export interface BreakModel {
  /** Each run, in the order given: the finished runs, oldest first, then the run in progress, if any. */
  readonly runs: readonly RunBreaks[];
  /** The recency-weighted P(break) at each index, over the runs that reached it. */
  readonly usual: Values;
  /** The total recency weight of the runs that reached each index. */
  readonly coverage: Values;
  /** How likely the verdict at each index (usual break or not) is right, from 0 to 1. */
  readonly confidence: Values;
  /** The non-increasing curve fitted to the confidence. */
  readonly confidenceTrend: Values;
  /**
   * The trust horizon: the verdicts at indices 1 to `horizon` are trusted, those after it aren't. 0 if none reaches
   * the level.
   */
  readonly horizon: number;
  /** The historical speed curve: the recency-weighted typical interval of the finished runs, in milliseconds. */
  readonly speedCurve: Values;
  /** The recency-weighted average interval at each index, in milliseconds, for display only. */
  readonly averageTime: Values;
  /** The mixture fitted, to warm-start the next fit; `undefined` while there's too little data to fit one. */
  readonly mixture: Mixture | undefined;
  readonly groups: readonly Group[];
}

/** The finished runs, as far as the model can work them out before the run in progress. */
export interface FinishedRuns {
  readonly window: number;
  /** The times of each run, oldest first. */
  readonly times: readonly (readonly number[])[];
  readonly logs: readonly Float64Array[];
  readonly baselines: readonly Float64Array[];
}

/** No interval is taken as shorter than this, in milliseconds, so it has a log. */
const SHORTEST_INTERVAL = 1;
/** Weighted EM stops after this many rounds, or once the log-likelihood gains less than {@link TOLERANCE}. */
const MAXIMUM_ROUNDS = 200;
const TOLERANCE = 1e-8;
/** The smallest spread a component can have, in log-interval: 0.1%. */
const SMALLEST_SD = 1e-3;

/** Works out the finished runs, from their times (in milliseconds since their first digit), oldest first. */
export function finishedRuns(runs: readonly (readonly number[])[], window: number): FinishedRuns {
  const logs = runs.map(logIntervals);
  return {
    window,
    times: runs,
    logs,
    baselines: logs.map((log) => centeredMedian(log, Math.min(window, log.length))),
  };
}

/**
 * Runs the model over the finished runs and, if given, the times of the run in progress (in milliseconds since its
 * first digit), which is then the newest. `init` is the last mixture fitted, to start the fit from.
 */
export function breakModel(
  finished: FinishedRuns,
  current: readonly number[] | undefined,
  settings: BreakSettings,
  init?: Mixture,
): BreakModel {
  const done =
    finished.window === settings.window ? finished : finishedRuns(finished.times, settings.window);
  const all = current === undefined ? done.times : [...done.times, current];
  const logs = [...done.logs, ...(current === undefined ? [] : [logIntervals(current)])];
  const count = logs.length;
  const weights = logs.map((_, k) => settings.recencyDecay ** (count - 1 - k));
  const longest = Math.max(0, ...logs.map((log) => log.length));

  // The historical speed curve: the weighted mean of the finished runs' baselines where they exist.
  const sums = new Float64Array(longest);
  const totals = new Float64Array(longest);
  done.baselines.forEach((baseline, k) => {
    const weight = weights[k] ?? 0;
    baseline.forEach((value, p) => {
      sums[p] = (sums[p] ?? 0) + weight * value;
      totals[p] = (totals[p] ?? 0) + weight;
    });
  });
  const historyLength = totals.findIndex((total) => total === 0);
  const history = sums
    .slice(0, historyLength === -1 ? longest : historyLength)
    .map((sum, p) => sum / (totals[p] ?? 1));

  const baselines = [...done.baselines];
  if (current !== undefined) {
    baselines.push(
      currentBaseline(logs[count - 1] ?? new Float64Array(), history, settings.window),
    );
  }

  // Pools the residuals, with their runs' weights, and fits the mixture.
  const total = logs.reduce((sum, log) => sum + log.length, 0);
  const residuals = new Float64Array(total);
  const pooledWeights = new Float64Array(total);
  let at = 0;
  logs.forEach((log, k) => {
    const baseline = baselines[k] ?? log;
    log.forEach((value, p) => {
      residuals[at] = value - (baseline[p] ?? value);
      pooledWeights[at] = weights[k] ?? 0;
      at++;
    });
  });
  const fit =
    total >= settings.window && total > 1 ? fitMixture(residuals, pooledWeights, init) : undefined;
  const posterior = fit?.posterior.map((p, i) =>
    (residuals[i] ?? 0) < fit.mixture.mean[0] ? 0 : p,
  );

  // Per run, then per index.
  at = 0;
  const runs = logs.map((log, k): RunBreaks => {
    const baseline = baselines[k] ?? log;
    const start = at;
    at += log.length;
    return {
      baseline: byIndex(Array.from(baseline, Math.exp)),
      breakProbability:
        posterior === undefined ? [] : byIndex(Array.from(posterior.subarray(start, at))),
    };
  });
  const usual: (number | undefined)[] = [undefined];
  const coverage: (number | undefined)[] = [undefined];
  const averageTime: (number | undefined)[] = [undefined];
  const breakSums: number[] = [];
  for (let p = 0; p < longest; p++) {
    let reached = 0;
    let breaks = 0;
    let time = 0;
    logs.forEach((log, k) => {
      const value = log[p];
      if (value === undefined) {
        return;
      }
      const weight = weights[k] ?? 0;
      reached += weight;
      breaks += weight * (runs[k]?.breakProbability[p + 1] ?? 0);
      time += weight * Math.exp(value);
    });
    coverage.push(reached);
    averageTime.push(time / reached);
    usual.push(fit === undefined ? undefined : breaks / reached);
    breakSums.push(breaks);
  }

  // The confidence in the verdict at each index, its trend, and the horizon.
  const raw =
    fit === undefined
      ? []
      : breakSums.map((breaks, p) => {
          const below = betaCdf(0.5, 1 + breaks, 1 + (coverage[p + 1] ?? 0) - breaks);
          return Math.max(below, 1 - below);
        });
  const trend = isotonicDecreasing(raw);
  const horizon = trend.filter((value) => value >= settings.level).length;

  return {
    runs,
    usual,
    coverage,
    confidence: fit === undefined ? [] : [undefined, ...raw],
    confidenceTrend: fit === undefined ? [] : [undefined, ...trend],
    horizon,
    speedCurve: byIndex(Array.from(history, Math.exp)),
    averageTime,
    mixture: fit?.mixture,
    groups: groupsOf(usual, Math.max(0, ...all.map((times) => times.length)), horizon),
  };
}

/** The log of each interval of a run, from its times: index p is the interval before digit p + 1. */
function logIntervals(times: readonly number[]): Float64Array {
  return Float64Array.from(times.slice(1), (time, p) =>
    Math.log(Math.max(SHORTEST_INTERVAL, time - (times[p] ?? time))),
  );
}

/** Values by interval, as values by index: interval p is the one before digit p + 1. */
function byIndex(values: readonly number[]): Values {
  return [undefined, ...values];
}

/**
 * The run in progress's baseline: the history plus this run's offset from it, a trailing median, where there's history,
 * and a trailing median of the run itself past it.
 */
function currentBaseline(log: Float64Array, history: Float64Array, window: number): Float64Array {
  const known = Math.min(log.length, history.length);
  const offsets = trailingMedian(
    log.subarray(0, known).map((value, p) => value - (history[p] ?? 0)),
    window,
  );
  const own = log.length > known ? trailingMedian(log, window) : new Float64Array();
  return log.map((_, p) => (p < known ? (history[p] ?? 0) + (offsets[p] ?? 0) : (own[p] ?? 0)));
}

/** A causal rolling median: the value at p is the median of the values from p - window + 1 to p. */
export function trailingMedian(values: Float64Array, window: number): Float64Array {
  return values.map((_, p) => median(values.slice(Math.max(0, p - window + 1), p + 1)));
}

/**
 * A centered rolling median of `size` values, the values mirrored past both ends (d c b a | a b c d | d c b a). For an
 * even size, the window reaches one value further back, and takes the higher of the two middle values.
 */
export function centeredMedian(values: Float64Array, size: number): Float64Array {
  const length = values.length;
  const back = Math.floor(size / 2);
  const window = new Float64Array(size);
  return values.map((_, p) => {
    for (let o = 0; o < size; o++) {
      const q = p - back + o;
      window[o] = values[q < 0 ? -q - 1 : q >= length ? 2 * length - q - 1 : q] ?? 0;
    }
    return window.sort()[back] ?? 0;
  });
}

function median(values: Float64Array): number {
  const sorted = values.sort();
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function normalDensity(x: number, mean: number, sd: number): number {
  return Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
}

/**
 * Fits a mixture of two normal distributions to the residuals, each counting with its weight, by weighted EM. Without
 * `init`, it starts from a normal component at the median and a break component 3 spreads above it (taking the median
 * absolute deviation as the spread).
 */
export function fitMixture(
  residuals: Float64Array,
  weights: Float64Array,
  init?: Mixture,
): { mixture: Mixture; posterior: Float64Array } {
  let share: [number, number];
  let mean: [number, number];
  let sd: [number, number];
  if (init === undefined) {
    const middle = median(residuals.slice());
    const spread = 1.4826 * median(residuals.map((r) => Math.abs(r - middle))) + 1e-6;
    share = [0.9, 0.1];
    mean = [middle, middle + 3 * spread];
    sd = [spread, 2 * spread];
  } else {
    share = [...init.weight];
    mean = [...init.mean];
    sd = [...init.sd];
  }
  const count = residuals.length;
  const posterior = new Float64Array(count);
  const expect = (): number => {
    let likelihood = 0;
    for (let i = 0; i < count; i++) {
      const r = residuals[i] ?? 0;
      const normal = share[0] * normalDensity(r, mean[0], sd[0]);
      const pause = share[1] * normalDensity(r, mean[1], sd[1]);
      // As tiny as can be, so that no point is impossible under either component.
      const both = normal + pause + 2e-300;
      posterior[i] = (pause + 1e-300) / both;
      likelihood += (weights[i] ?? 0) * Math.log(both);
    }
    return likelihood;
  };
  let previous = -Infinity;
  for (let round = 0; round < MAXIMUM_ROUNDS; round++) {
    const likelihood = expect();
    let pauses = 0;
    let all = 0;
    let pauseSum = 0;
    let normalSum = 0;
    for (let i = 0; i < count; i++) {
      const w = weights[i] ?? 0;
      const p = posterior[i] ?? 0;
      const r = residuals[i] ?? 0;
      all += w;
      pauses += w * p;
      pauseSum += w * p * r;
      normalSum += w * (1 - p) * r;
    }
    const normals = all - pauses;
    if (!(normals > 0 && pauses > 0)) {
      // A component lost every point: there's only one kind of interval.
      break;
    }
    mean = [normalSum / normals, pauseSum / pauses];
    let normalSquares = 0;
    let pauseSquares = 0;
    for (let i = 0; i < count; i++) {
      const w = weights[i] ?? 0;
      const p = posterior[i] ?? 0;
      const r = residuals[i] ?? 0;
      normalSquares += w * (1 - p) * (r - mean[0]) ** 2;
      pauseSquares += w * p * (r - mean[1]) ** 2;
    }
    share = [normals / all, pauses / all];
    sd = [
      Math.max(Math.sqrt(normalSquares / normals), SMALLEST_SD),
      Math.max(Math.sqrt(pauseSquares / pauses), SMALLEST_SD),
    ];
    if (likelihood - previous < TOLERANCE) {
      break;
    }
    previous = likelihood;
  }
  // Component 0 stays the normal one, 1 the break.
  if (mean[1] < mean[0]) {
    share = [share[1], share[0]];
    mean = [mean[1], mean[0]];
    sd = [sd[1], sd[0]];
  }
  expect();
  return { mixture: { weight: share, mean, sd }, posterior };
}

/** The least-squares non-increasing fit of the values, by pooling adjacent violators. */
export function isotonicDecreasing(values: readonly number[]): number[] {
  const means: number[] = [];
  const sizes: number[] = [];
  for (const value of values) {
    means.push(value);
    sizes.push(1);
    while (means.length > 1 && (means.at(-2) ?? 0) < (means.at(-1) ?? 0)) {
      const later = means.pop() ?? 0;
      const laterSize = sizes.pop() ?? 0;
      const size = sizes.at(-1) ?? 0;
      means[means.length - 1] =
        ((means.at(-1) ?? 0) * size + later * laterSize) / (size + laterSize);
      sizes[sizes.length - 1] = size + laterSize;
    }
  }
  return means.flatMap((mean, k) => Array<number>(sizes[k] ?? 0).fill(mean));
}

/** The cumulative distribution function of the Beta(a, b) distribution at x: the regularized incomplete beta. */
export function betaCdf(x: number, a: number, b: number): number {
  if (x <= 0) {
    return 0;
  }
  if (x >= 1) {
    return 1;
  }
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (front * betaFraction(x, a, b)) / a
    : 1 - (front * betaFraction(1 - x, b, a)) / b;
}

/** The continued fraction of the incomplete beta function, by the modified Lentz method. */
function betaFraction(x: number, a: number, b: number): number {
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  d = 1 / (Math.abs(d) < tiny ? tiny : d);
  let result = d;
  for (let m = 1; m <= 300; m++) {
    for (const numerator of [
      (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m)),
      -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1)),
    ]) {
      d = 1 + numerator * d;
      d = 1 / (Math.abs(d) < tiny ? tiny : d);
      c = 1 + numerator / c;
      c = Math.abs(c) < tiny ? tiny : c;
      result *= c * d;
    }
    if (Math.abs(c * d - 1) < 1e-14) {
      break;
    }
  }
  return result;
}

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** The log of the gamma function, for positive numbers, by the Lanczos approximation. */
function logGamma(x: number): number {
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const z = x - 1;
  let sum = LANCZOS[0] ?? 1;
  for (let k = 1; k < LANCZOS.length; k++) {
    sum += (LANCZOS[k] ?? 0) / (z + k);
  }
  const t = z + LANCZOS.length - 1.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

/**
 * The groups cut by the usual break spots, over `digits` digits; a group is trusted when the break ending it is within
 * the horizon.
 */
function groupsOf(usual: Values, digits: number, horizon: number): Group[] {
  const found: Group[] = [];
  let start = 0;
  for (let i = 1; i <= digits; i++) {
    const open = i === digits;
    if (!open && (usual[i] ?? 0) <= 0.5) {
      continue;
    }
    found.push({ start, size: i - start, open, trusted: !open && i <= horizon });
    start = i;
  }
  return found;
}
