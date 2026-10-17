import type { BreakModelKind, Settings } from './break-model';
import { BreakSettings, HYPERPARAMETERS } from './hyperparameters';
import { modelFromSteps } from './model-from-steps';
import { centeredMedian, median, Mixture, trailingMedian } from './statistics';
import {
  byIndex,
  fitBreaks,
  groupsOf,
  logIntervals,
  longestOf,
  runWeights,
  Steps,
  trustOf,
  usualBreaks,
} from './steps';

/**
 * Mercury, the first break model: classifies the intervals of the player's runs as breaks or not, with a probability,
 * finds where in π this player usually breaks, and up to which place those conclusions can be trusted, by the steps of
 * `steps.ts`. A break is judged against this player at this place, never against a fixed threshold or their overall
 * speed: players type the digits they know best faster than the last ones they know, so either would cut the slow end
 * into single digits.
 *
 * Its own step is the baseline of each run. A finished run's is a centered rolling median along the places. The run in
 * progress uses only what has been typed so far: the historical speed curve (the recency-weighted mean of the finished
 * runs' baselines, the synthetic runs' at the prior baseline) plus this run's own offset from it, a trailing rolling
 * median shrunk toward the finished runs' typical offset while it has few intervals to go on. The baseline is smooth
 * along the places on purpose: a median at each place across runs would absorb breaks the player makes at the same
 * place every time.
 *
 * Nothing here is stored; it's always computed from the times of the runs.
 */

export const MERCURY_DEFAULTS: BreakSettings = {
  window: 21,
  recencyDecay: 0.9,
  level: 0.9,
  priorStrength: 5,
  syntheticRuns: 5,
  syntheticDecay: 0.5,
  priorBaseline: 300,
  priorBreakShare: 0.15,
  priorBreakSize: 2.5,
  priorNormalSpread: 0.25,
  priorBreakSpread: 0.4,
  breakThreshold: 0.5,
  usualThreshold: 0.5,
  startingSlots: 5,
};

const H = HYPERPARAMETERS;

/** Mercury, as developer mode picks and tunes it. */
export const MERCURY: BreakModelKind = {
  id: 'mercury',
  label: 'Mercury',
  description:
    'Each run’s breaks against its own baseline, then how often the runs break at each place.',
  defaults: MERCURY_DEFAULTS,
  // In the order the model uses them: how the runs are weighed, then each run's baseline, then the mixture that tells
  // breaks from normal intervals, then how breaks make groups. Four at most to a tab, so that none of them need
  // scrolling.
  tabs: [
    {
      name: 'Weights',
      hyperparameters: [H.recencyDecay, H.syntheticRuns, H.syntheticDecay, H.priorBaseline],
    },
    { name: 'Baseline', hyperparameters: [H.window, H.priorStrength] },
    {
      name: 'Mixture',
      hyperparameters: [
        H.priorBreakShare,
        H.priorBreakSize,
        H.priorNormalSpread,
        H.priorBreakSpread,
      ],
    },
    {
      name: 'Groups',
      hyperparameters: [H.breakThreshold, H.usualThreshold, H.level, H.startingSlots],
    },
  ],
  create: (tuned) => {
    const settings = withDefaults(tuned);
    return modelFromSteps(settings, (finished) => {
      const done = finishedRuns(finished, settings.window);
      return (current, init) => mercury(done, current, settings, init);
    });
  },
  steps: (tuned, finished) => {
    const settings = withDefaults(tuned);
    return mercury(finishedRuns(finished, settings.window), undefined, settings);
  },
};

/** Mercury's hyperparameters, each one not tuned at its default. */
function withDefaults(tuned: Settings): BreakSettings {
  return { ...MERCURY_DEFAULTS, ...tuned };
}

/** The finished runs, as far as the model can work them out before the run in progress. */
export interface FinishedRuns {
  readonly window: number;
  /** The times of each run, oldest first. */
  readonly times: readonly (readonly number[])[];
  readonly logs: readonly Float64Array[];
  readonly baselines: readonly Float64Array[];
}

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
export function mercury(
  finished: FinishedRuns,
  current: readonly number[] | undefined,
  settings: BreakSettings,
  init?: Mixture,
): Steps {
  const done =
    finished.window === settings.window ? finished : finishedRuns(finished.times, settings.window);
  const all = current === undefined ? done.times : [...done.times, current];
  const logs = [...done.logs, ...(current === undefined ? [] : [logIntervals(current)])];
  const { weights, synthetic } = runWeights(logs.length, settings);
  const longest = longestOf(logs);
  const earlier = [
    ...done.baselines,
    new Float64Array(longest).fill(Math.log(settings.priorBaseline)),
  ];
  const earlierWeights = [...weights.slice(0, done.times.length), synthetic];
  const history = speedHistory(earlier, earlierWeights, longest);
  const baselines = [...done.baselines];
  if (current !== undefined) {
    baselines.push(
      currentBaseline(
        logs.at(-1) ?? new Float64Array(),
        history,
        priorOffset(earlier, history, earlierWeights),
        settings,
      ),
    );
  }

  const { runs, mixture } = fitBreaks(logs, baselines, weights, synthetic, settings, init);
  const { usual, coverage, breaks, averageTime } = usualBreaks(
    logs,
    runs,
    weights,
    synthetic,
    settings,
  );
  const trust = trustOf(usual, breaks, coverage, settings);
  return {
    settings,
    runs,
    usual,
    coverage,
    ...trust,
    speedCurve: byIndex(Array.from(history, Math.exp)),
    averageTime,
    mixture,
    groups: groupsOf(
      usual,
      settings.usualThreshold,
      Math.max(0, ...all.map((times) => times.length)),
      trust.horizon,
    ),
  };
}

/**
 * The historical speed curve, over `longest` intervals: the weighted mean of the earlier runs' baselines where they
 * exist, up to where none does.
 */
function speedHistory(
  baselines: readonly Float64Array[],
  weights: readonly number[],
  longest: number,
): Float64Array {
  const sums = new Float64Array(longest);
  const totals = new Float64Array(longest);
  baselines.forEach((baseline, k) => {
    const weight = weights[k] ?? 0;
    if (weight === 0) {
      return;
    }
    baseline.forEach((value, p) => {
      sums[p] = (sums[p] ?? 0) + weight * value;
      totals[p] = (totals[p] ?? 0) + weight;
    });
  });
  const historyLength = totals.findIndex((total) => total === 0);
  return sums
    .slice(0, historyLength === -1 ? longest : historyLength)
    .map((sum, p) => sum / (totals[p] ?? 1));
}

/** The recency-weighted mean offset of the earlier runs from the history: each run's median of baseline − history. */
function priorOffset(
  baselines: readonly Float64Array[],
  history: Float64Array,
  weights: readonly number[],
): number {
  let sum = 0;
  let total = 0;
  baselines.forEach((baseline, k) => {
    if (baseline.length === 0) {
      return;
    }
    const weight = weights[k] ?? 0;
    sum += weight * median(baseline.map((value, p) => value - (history[p] ?? 0)));
    total += weight;
  });
  return total > 0 ? sum / total : 0;
}

/**
 * The run in progress's baseline. Where there's history, the history plus this run's offset from it: a trailing median,
 * shrunk toward the earlier runs' offset while it has few intervals to go on, so the first intervals are judged
 * against history. Past the end of history, which only ends without synthetic runs, a trailing median of the run
 * itself.
 */
function currentBaseline(
  log: Float64Array,
  history: Float64Array,
  prior: number,
  settings: BreakSettings,
): Float64Array {
  const { window, priorStrength } = settings;
  const known = Math.min(log.length, history.length);
  // The estimate from `n` intervals, with `prior` counting as `priorStrength` of them.
  const shrunk = (estimate: number, p: number, toward: number): number => {
    const n = Math.min(p + 1, window);
    return (priorStrength * toward + n * estimate) / (priorStrength + n);
  };
  const offsets = trailingMedian(
    log.subarray(0, known).map((value, p) => value - (history[p] ?? 0)),
    window,
  );
  const own = log.length > known ? trailingMedian(log, window) : new Float64Array();
  return log.map((_, p) =>
    p < known ? (history[p] ?? 0) + shrunk(offsets[p] ?? 0, p, prior) : (own[p] ?? 0),
  );
}
