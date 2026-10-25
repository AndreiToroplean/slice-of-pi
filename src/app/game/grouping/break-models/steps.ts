import type { Break, Group, Settings, Values } from './break-model';
import type { BreakSettings } from './hyperparameters';
import { betaCdf, fitMixture, isotonicDecreasing, Mixture } from './statistics';
import type { Workings } from './workings';

/**
 * The steps of the break models that tell breaks by a baseline and a mixture, as Mercury (`mercury.ts`) does, so that
 * each model can take those it shares and only change the others:
 *
 * 1. They work in log(interval), since breaks are multiplicative: "x% slower than usual".
 * 2. The runs are weighed by recency, synthetic runs included ({@link runWeights}).
 * 3. Each run has a baseline, its expected log-interval at each place without the breaks: each model has its own.
 * 4. The residual of an interval is its log minus the baseline. A mixture of two normal distributions (normal and break)
 *    is fitted to all the residuals pooled, each weighted by its run's weight, by weighted EM (expectation–maximization).
 *    P(break) is the posterior probability of the break component, 0 below the normal mean: a break is never faster
 *    ({@link fitBreaks}). An interval is taken for a break when it's over the break threshold.
 * 5. The usual-break probability at a place is the weighted average of P(break) over the runs that reached it. The usual
 *    break spots are the places where it's over the usual threshold ({@link usualBreaks}).
 * 6. The confidence at a place is the probability that its verdict (usual break or not) is right, that is that its
 *    break rate is on the verdict's side of the usual threshold, from a Beta posterior over the rate. It drops as fewer
 *    runs reach a place and as they disagree, but it's noisy, so a non-increasing curve is fitted to it (isotonic
 *    regression), the confidence trend. That crosses the required level once: the trust horizon ({@link trustOf}).
 *
 * Synthetic runs, older than all the player's, count in every step like the player's runs, with their own recency
 * decay between them: they give the model something to go on before the player's runs say enough, and fade as those
 * come. No synthetic run is ever made up: each step adds what they would add up to, as their weight times the prior.
 *
 * Places are indexed like the digits of a run: index 0 is the first digit typed. The interval at index i is the time
 * from digit i - 1 to digit i, and the verdict there is about the boundary just before digit i, so index 0 never has
 * one.
 */

/** What a model makes of one run, step by step. */
export interface RunSteps {
  /** The baseline at each index: the interval expected there without a break, in milliseconds. */
  readonly baseline: Values;
  /** P(break) at each index, from 0 to 1. */
  readonly breakProbability: Values;
  /** The residual at each index: the log of its interval over its baseline. */
  readonly residual: Values;
}

/**
 * What a model makes of the runs, step by step, as developer mode shows it, with the hyperparameters it took. A model
 * that tells breaks by a mixture ({@link fitBreaks}) took these, and gives the mixture fitted; any other took its own,
 * with the thresholds it decides by.
 */
export type Steps = {
  /** Each run, in the order given: the finished runs, oldest first, then the run in progress, if any. */
  readonly runs: readonly RunSteps[];
  /** The weighted P(break) at each index, over the runs that reached it, synthetic ones included. */
  readonly usual: Values;
  /** The total weight of the runs that reached each index, synthetic ones included. */
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
  /** The typical interval at each index, without breaks, in milliseconds. */
  readonly speedCurve: Values;
  /** The recency-weighted average interval of the player's runs at each index, in milliseconds, for display only. */
  readonly averageTime: Values;
  readonly groups: readonly Group[];
  /** What a model that judges each run on its own worked out on the way, for developer mode to show, if it did. */
  readonly workings?: Workings;
} & (
  | {
      readonly settings: BreakSettings;
      /** The mixture fitted, to warm-start the next fit, or the prior mixture without any interval. */
      readonly mixture: Mixture;
    }
  | {
      readonly settings: Settings &
        Pick<BreakSettings, 'breakThreshold' | 'usualThreshold' | 'level' | 'startingSlots'>;
      readonly mixture?: undefined;
    }
);

/** No interval is taken as shorter than this, in milliseconds, so it has a log. */
const SHORTEST_INTERVAL = 1;

/** The log of each interval of a run, from its times: index p is the interval before digit p + 1. */
export function logIntervals(times: readonly number[]): Float64Array {
  return Float64Array.from(times.slice(1), (time, p) =>
    Math.log(Math.max(SHORTEST_INTERVAL, time - (times[p] ?? time))),
  );
}

/** Values by interval, as values by index: interval p is the one before digit p + 1. */
export function byIndex(values: Values): Values {
  return [undefined, ...values];
}

/** The mixture of the synthetic runs' intervals, and the one the fit starts from without a better one. */
export function priorMixture(settings: BreakSettings): Mixture {
  return {
    weight: [1 - settings.priorBreakShare, settings.priorBreakShare],
    mean: [0, Math.log(settings.priorBreakSize)],
    sd: [settings.priorNormalSpread, settings.priorBreakSpread],
  };
}

/**
 * The weight of each of `count` runs, oldest first, `recencyDecay ** age`, the newest weighing 1; and the synthetic
 * runs' weight, all together: they're the oldest runs, after the player's.
 */
export function runWeights(
  count: number,
  settings: BreakSettings,
): { readonly weights: readonly number[]; readonly synthetic: number } {
  let synthetic = 0;
  for (let j = 0; j < settings.syntheticRuns; j++) {
    synthetic += settings.recencyDecay ** count * settings.syntheticDecay ** j;
  }
  return {
    weights: Array.from({ length: count }, (_, k) => settings.recencyDecay ** (count - 1 - k)),
    synthetic,
  };
}

/**
 * Each run's residuals over its baseline, pooled with their weights (each run's, or its weight at each interval), the
 * mixture fitted to them, and P(break) at each interval. The synthetic runs count as the prior mixture's pseudo-intervals, which makes the fit a MAP estimate.
 * `init` is the last mixture fitted, to start the fit from.
 */
export function fitBreaks(
  logs: readonly Float64Array[],
  baselines: readonly Float64Array[],
  weights: readonly (number | Float64Array)[],
  synthetic: number,
  settings: BreakSettings,
  init?: Mixture,
): { readonly runs: readonly RunSteps[]; readonly mixture: Mixture } {
  const total = logs.reduce((sum, log) => sum + log.length, 0);
  const residuals = new Float64Array(total);
  const pooledWeights = new Float64Array(total);
  let at = 0;
  logs.forEach((log, k) => {
    const baseline = baselines[k] ?? log;
    const weight = weights[k] ?? 0;
    log.forEach((value, p) => {
      residuals[at] = value - (baseline[p] ?? value);
      pooledWeights[at] = typeof weight === 'number' ? weight : (weight[p] ?? 0);
      at++;
    });
  });
  const prior = priorMixture(settings);
  const fit = fitMixture(residuals, pooledWeights, init ?? (total === 0 ? prior : undefined), {
    mixture: prior,
    strength: synthetic * longestOf(logs),
  });
  const posterior = fit.posterior.map((p, i) =>
    (residuals[i] ?? 0) < fit.mixture.mean[0] ? 0 : p,
  );
  at = 0;
  const runs = logs.map((log, k): RunSteps => {
    const baseline = baselines[k] ?? log;
    const start = at;
    at += log.length;
    return {
      baseline: byIndex(Array.from(baseline, Math.exp)),
      breakProbability: byIndex(Array.from(posterior.subarray(start, at))),
      residual: byIndex(Array.from(residuals.subarray(start, at))),
    };
  });
  return { runs, mixture: fit.mixture };
}

/**
 * At each index, the weighted P(break) over the runs that reached it, the synthetic runs, if any, breaking there as
 * often as the prior says; the weight of those runs; the weight of their breaks; and the player's runs' average
 * interval. Each run weighs its weight, or its weight at each interval.
 */
export function usualBreaks(
  logs: readonly Float64Array[],
  runs: readonly Pick<RunSteps, 'breakProbability'>[],
  weights: readonly (number | Float64Array)[],
  synthetic: Synthetic = NO_SYNTHETIC,
): {
  readonly usual: Values;
  readonly coverage: Values;
  readonly breaks: readonly number[];
  readonly averageTime: Values;
} {
  return usualOf(breakSums(logs, runs, weights, synthetic));
}

/** The synthetic runs' weight, all together, and how often they break. */
interface Synthetic {
  readonly weight: number;
  readonly breakShare: number;
}

const NO_SYNTHETIC: Synthetic = { weight: 0, breakShare: 0 };

/**
 * What {@link usualBreaks} adds up at each interval, so that runs can be added to the sums of others: the weight of the
 * runs that reached it, synthetic ones included, and of their breaks; and the weight of the player's runs timed there,
 * and of their intervals.
 */
export interface BreakSums {
  readonly reached: readonly number[];
  readonly breaks: readonly number[];
  readonly timed: readonly number[];
  readonly time: readonly number[];
}

/**
 * The sums of {@link usualBreaks} over the runs, added in order to those of `from`, of earlier runs, if given; else
 * to the synthetic runs' alone.
 */
export function breakSums(
  logs: readonly Float64Array[],
  runs: readonly Pick<RunSteps, 'breakProbability'>[],
  weights: readonly (number | Float64Array)[],
  synthetic: Synthetic = NO_SYNTHETIC,
  from?: BreakSums,
): BreakSums {
  const sums = {
    reached: [] as number[],
    breaks: [] as number[],
    timed: [] as number[],
    time: [] as number[],
  };
  for (let p = 0; p < Math.max(from?.reached.length ?? 0, longestOf(logs)); p++) {
    let reached = from?.reached[p] ?? synthetic.weight;
    let breaks = from?.breaks[p] ?? synthetic.weight * synthetic.breakShare;
    let timed = from?.timed[p] ?? 0;
    let time = from?.time[p] ?? 0;
    logs.forEach((log, k) => {
      const value = log[p];
      if (value === undefined) {
        return;
      }
      const runWeight = weights[k] ?? 0;
      const weight = typeof runWeight === 'number' ? runWeight : (runWeight[p] ?? 0);
      reached += weight;
      breaks += weight * (runs[k]?.breakProbability[p + 1] ?? 0);
      timed += weight;
      time += weight * Math.exp(value);
    });
    sums.reached.push(reached);
    sums.breaks.push(breaks);
    sums.timed.push(timed);
    sums.time.push(time);
  }
  return sums;
}

/** What {@link usualBreaks} gives, from its sums. */
export function usualOf(sums: BreakSums): ReturnType<typeof usualBreaks> {
  return {
    usual: [
      undefined,
      ...sums.reached.map((reached, p) => (reached > 0 ? (sums.breaks[p] ?? 0) / reached : 0)),
    ],
    coverage: [undefined, ...sums.reached],
    breaks: sums.breaks,
    averageTime: [
      undefined,
      ...sums.timed.map((timed, p) => (timed > 0 ? (sums.time[p] ?? 0) / timed : undefined)),
    ],
  };
}

/**
 * The confidence in the verdict at each index (that the break rate is on its side of the usual threshold), from the
 * weight of the breaks at each interval and of the runs that reached it, its trend, and the horizon.
 */
export function trustOf(
  usual: Values,
  breaks: readonly number[],
  coverage: Values,
  settings: Pick<BreakSettings, 'usualThreshold' | 'level'>,
): { readonly confidence: Values; readonly confidenceTrend: Values; readonly horizon: number } {
  const threshold = settings.usualThreshold;
  const raw = breaks.map((weight, p) => {
    const below = betaCdf(threshold, 1 + weight, 1 + (coverage[p + 1] ?? 0) - weight);
    return (usual[p + 1] ?? 0) > threshold ? 1 - below : below;
  });
  const trend = isotonicDecreasing(raw);
  return {
    confidence: [undefined, ...raw],
    confidenceTrend: [undefined, ...trend],
    horizon: trend.filter((value) => value >= settings.level).length,
  };
}

/**
 * The groups cut by the usual break spots, over `digits` digits; a group is trusted when the break ending it is within
 * the horizon.
 */
export function groupsOf(
  usual: Values,
  threshold: number,
  digits: number,
  horizon: number,
): Group[] {
  const breaks: number[] = [];
  for (let i = 1; i < digits; i++) {
    if ((usual[i] ?? 0) > threshold) {
      breaks.push(i);
    }
  }
  return groupsBetween(breaks, digits, horizon);
}

/**
 * The groups cut by the breaks at these indices, in order, over `digits` digits; a group is trusted when the break
 * ending it is within the horizon.
 */
export function groupsBetween(breaks: readonly number[], digits: number, horizon: number): Group[] {
  if (digits === 0) {
    return [];
  }
  return [...breaks, digits].map((end, k) => {
    const start = breaks[k - 1] ?? 0;
    const open = end === digits;
    return { start, size: end - start, open, trusted: !open && end <= horizon };
  });
}

/** A break wherever the probability is over the threshold, the stronger the further over it. */
export function breaksOf(probabilities: Values, threshold: number): Break[] {
  return probabilities.flatMap((p, i) =>
    p !== undefined && p > threshold
      ? [{ place: i, strength: (p - threshold) / (1 - threshold) }]
      : [],
  );
}

/** How many intervals the longest run has. */
export function longestOf(logs: readonly Float64Array[]): number {
  return Math.max(0, ...logs.map((log) => log.length));
}
