import type { BreakModel, BreakModelKind, Hyperparameter, Settings, Values } from './break-model';
import { BreakSettings, HYPERPARAMETERS, oneIn } from './hyperparameters';
import { groupEnds, modelFromSteps } from './model-from-steps';
import { neighborsOf } from './statistics';
import { byIndex, groupsOf, logIntervals, RunSteps, Steps, trustOf, usualBreaks } from './steps';

/**
 * Terra: Venus's aim, a model whose hyperparameters mean the same whether the player has played one run or a hundred.
 * Venus judges the runs averaged place by place, and an average of more runs is smoother: its normal intervals spread
 * less and the odd long pause of one run weighs less in it, so the mixture fitted to it, and the hyperparameters that
 * suit it, change with the number of runs. Terra only ever judges one run at a time, in terms that don't depend on the
 * others, and only then pools what the runs say, as an average whose meaning doesn't depend on how many there are.
 *
 * So it's Mercury (`mercury.ts`) without synthetic runs, whose weight against the player's runs falls as they come,
 * judging each run as Luna (`luna.ts`) does, against the pace and spread around each interval, rather than by a
 * mixture fitted to all of them:
 *
 * 1. Each interval of a run is compared with its neighbors in that run, leaving itself out: its log against their
 *    weighted mean of logs (the local pace), in units of their spread (the local spread), its z. Normal intervals have a
 *    z of about 0 give or take 1 wherever the player is and however they type there; breaks have a z of about the break
 *    shift, give or take 1, so its likelihood ratio grows with z, and a pause long enough is a break whatever came
 *    before.
 * 2. Each run's P(break) at a place is that likelihood against the break share, its prior: 0 for an interval faster than
 *    its pace, since a break is never faster.
 * 3. The usual-break probability at a place is the weighted average of the runs' P(break) there: the share of the runs
 *    that break there, whatever their number. A run weighs its recency times how much it's trusted there, as in Luna:
 *    as much as it's uneven around the place, since where the player types like a metronome, a break is just noise.
 *    The usual break spots are where it's over the usual threshold; the confidence and trust horizon come from it as in
 *    Mercury, and so does the average time, its weights being the trust's.
 * 4. The run being typed breaks at a place with the finished runs' usual-break probability there as its prior: a short
 *    pause ends a group where the player usually breaks, and a long one wherever they don't. That's how the game ends
 *    every group, within the trust horizon or past it.
 *
 * No mixture is fitted and there are no synthetic runs: nothing in a run's verdict depends on the other runs, so a new
 * player's first run is judged as their hundredth is. Nothing here is stored; it's always computed from the times of
 * the runs.
 */

/**
 * Terra's hyperparameters, to be tuned by play testing. The window is the span of the neighbors of a place, centered on
 * it.
 */
export type TerraSettings = Pick<
  BreakSettings,
  'window' | 'recencyDecay' | 'level' | 'breakThreshold' | 'usualThreshold' | 'startingSlots'
> &
  Readonly<{
    /** The smallest local spread, in log-interval: where a run is steadier than this, it's taken as this steady. */
    spreadFloor: number;
    /** How many local spreads above the local pace a typical break is. */
    breakShift: number;
    /** The share of intervals that are breaks, before an interval says anything, from 0 to 1. */
    breakShare: number;
    /** The local spread, in log-interval, at which a run's verdict is fully trusted. */
    fullTrustUnevenness: number;
  }>;

/** Fitted to Andrei's groupings over random sets of 1 to 24 of his runs at once, so as to suit every number of runs. */
export const TERRA_DEFAULTS: TerraSettings = {
  window: 11,
  recencyDecay: 0.96,
  spreadFloor: 0.17,
  breakShift: 1.2,
  breakShare: 0.3,
  fullTrustUnevenness: 0.3,
  usualThreshold: 0.4,
  breakThreshold: 0.5,
  level: 0.9,
  startingSlots: 5,
};

/** The prior of the run being typed stays this far from 0 and 1, so that a long enough pause can always outweigh it. */
const SUREST_PRIOR = 1e-3;

/** One run's verdict at one place. */
export interface Judged {
  /** The time the player took to type this digit after the one before, in milliseconds. */
  readonly time: number;
  /** The local pace, in milliseconds; `undefined` without neighbors. */
  readonly pace: number | undefined;
  /** The log of the time over the local pace, in local spreads: 0 without neighbors. */
  readonly z: number;
  /**
   * The log of how much likelier the time is for a break than for a normal interval, as far below 0 as the time is
   * faster than its pace as above it as the time is slower: 0 without neighbors.
   */
  readonly evidence: number;
  /** How much likelier the time is for a break than for a normal interval: 0 below the pace, a break never faster. */
  readonly likelihood: number;
  /** How much this verdict counts in the vote, from 0 to 1. */
  readonly trust: number;
}

/**
 * One run, judged: how many digits it has, its log intervals, and its verdict at each interval (index p is the one
 * before digit p + 1).
 */
export interface JudgedRun {
  readonly digits: number;
  readonly logs: Float64Array;
  readonly places: readonly Judged[];
}

/**
 * Judges every place of one run, from its times (in milliseconds since its first digit), each against its neighbors in
 * the run.
 */
export function judge(
  times: readonly number[],
  settings: Pick<TerraSettings, 'window' | 'spreadFloor' | 'breakShift' | 'fullTrustUnevenness'>,
): JudgedRun {
  const logs = logIntervals(times);
  const places = Array.from(logs, (log, p): Judged => {
    const { mean: pace, spread: unevenness, count } = neighborsOf(logs, p, settings.window);
    const time = Math.exp(log);
    if (count === 0) {
      return { time, pace: undefined, z: 0, evidence: 0, likelihood: 1, trust: 0 };
    }
    const z = (log - pace) / Math.max(unevenness, settings.spreadFloor);
    // Normal intervals are N(0, 1) in z, breaks N(breakShift, 1): the log of the ratio of the two densities.
    const shift = settings.breakShift;
    const evidence = shift * z - (shift * shift) / 2;
    return {
      time,
      pace: Math.exp(pace),
      z,
      evidence,
      likelihood: z < 0 ? 0 : Math.exp(evidence),
      trust: Math.min(1, unevenness / settings.fullTrustUnevenness),
    };
  });
  return { digits: times.length, logs, places };
}

/** The probability of a break, from its prior and how much likelier the interval is for one. */
function breakProbability(prior: number, likelihood: number): number {
  const odds = (prior / (1 - prior)) * likelihood;
  return Number.isFinite(odds) ? odds / (1 + odds) : 1;
}

/**
 * Runs the model over the judged finished runs, oldest first, and, if given, the times of the run in progress (in
 * milliseconds since its first digit), which is then the newest.
 */
export function terra(
  finished: readonly JudgedRun[],
  current: readonly number[] | undefined,
  settings: TerraSettings,
): Steps {
  const runs = current === undefined ? finished : [...finished, judge(current, settings)];
  const logs = runs.map((run) => run.logs);
  // Each run's own P(break), and its weight at each interval: its recency times its trust there.
  const own = runs.map((run) => ({
    breakProbability: byIndex(
      run.places.map((at) => breakProbability(settings.breakShare, at.likelihood)),
    ),
  }));
  const weights = runs.map((run, k) =>
    Float64Array.from(
      run.places,
      (at) => settings.recencyDecay ** (runs.length - 1 - k) * at.trust,
    ),
  );
  const { usual, coverage, breaks, averageTime } = usualBreaks(logs, own, weights);
  const before = usualBreaks(
    logs.slice(0, finished.length),
    own.slice(0, finished.length),
    weights.slice(0, finished.length),
  );

  const steps = (run: JudgedRun, breakProbability: Values): RunSteps => ({
    baseline: byIndex(run.places.map((at) => at.pace)),
    breakProbability,
    residual: byIndex(
      run.places.map((at) => (at.pace === undefined ? undefined : Math.log(at.time / at.pace))),
    ),
  });
  // The run being typed breaks with the finished runs' usual-break probability as its prior, where they reached.
  const runSteps = runs.map((run, k) =>
    k < finished.length
      ? steps(run, own[k]?.breakProbability ?? [])
      : steps(
          run,
          byIndex(
            run.places.map((at, p) =>
              breakProbability(
                Math.min(
                  Math.max(before.usual[p + 1] ?? settings.breakShare, SUREST_PRIOR),
                  1 - SUREST_PRIOR,
                ),
                at.likelihood,
              ),
            ),
          ),
        ),
  );
  const speedCurve = usualPace(runs, settings);
  const trust = trustOf(usual, breaks, coverage, settings);
  return {
    settings,
    runs: runSteps,
    usual,
    coverage,
    ...trust,
    speedCurve,
    averageTime,
    groups: groupsOf(
      usual,
      settings.usualThreshold,
      Math.max(0, ...runs.map((run) => run.digits)),
      trust.horizon,
    ),
  };
}

/** The recency-weighted mean of the runs' local paces at each index, in milliseconds. */
export function usualPace(
  runs: readonly JudgedRun[],
  settings: Pick<TerraSettings, 'recencyDecay'>,
): Values {
  const longest = Math.max(0, ...runs.map((run) => run.places.length));
  return byIndex(
    Array.from({ length: longest }, (_, p) => {
      let weights = 0;
      let sum = 0;
      runs.forEach((run, k) => {
        const pace = run.places[p]?.pace;
        if (pace !== undefined) {
          const weight = settings.recencyDecay ** (runs.length - 1 - k);
          weights += weight;
          sum += weight * pace;
        }
      });
      return weights > 0 ? sum / weights : undefined;
    }),
  );
}

/**
 * Terra as the game sees it. The run being typed already weighs the player's usual breaks in its own P(break), so every
 * group ends where that's over the break threshold, within the trust horizon or past it, as past it in Mercury.
 */
function terraModel(settings: TerraSettings): BreakModel {
  return modelFromSteps(
    (finished) => {
      const judged = finished.map((times) => judge(times, settings));
      return (current) => terra(judged, current, settings);
    },
    (steps, next) => groupEnds(steps, next, false),
  );
}

/** The hyperparameters of Terra's own, by key, as their sliders show them. */
export const TERRA_HYPERPARAMETERS = {
  spreadFloor: {
    key: 'spreadFloor',
    label: 'Spread floor',
    min: 0.02,
    max: 0.5,
    step: 0.01,
    format: (value) =>
      `${value.toFixed(2)} (about ${String(Math.round((Math.exp(value) - 1) * 100))}%)`,
    help: {
      what: 'Each interval is compared with its neighbors in the same run: how much longer it is than their pace, counted in their spread, how much they vary. Where they vary less than this, they’re taken as varying this much, in log-interval: 0.2 is about 22% either way.',
      why: 'Counted in the spread so that a break means the same wherever you are and however you type there: where you type steadily, a small delay stands out; where you swing, it takes more. The floor keeps a run of very even keystrokes from making any slightly slow one a break.',
      moving:
        'Higher asks for longer pauses where you type steadily, so fewer, bigger groups there. Lower lets small delays count as breaks where you’re even.',
    },
  },
  breakShift: {
    key: 'breakShift',
    label: 'Break shift',
    min: 0.2,
    max: 4,
    step: 0.1,
    format: (value) => `${value.toFixed(1)} spreads`,
    help: {
      what: 'How many spreads above the pace around it a typical break is. Normal intervals are about the pace, give or take a spread; breaks are about this far above it, give or take a spread.',
      why: 'These two make how likely an interval is a break, from how far above the pace it is: the further, the likelier, so a pause long enough is always a break. No run’s verdict depends on the other runs, so a break means the same after one run as after a hundred.',
      moving:
        'Higher makes the likelihood rise faster past half the shift: long pauses are sure breaks and short ones sure normal intervals. Lower blurs the two, so a run’s verdicts are less sure and the vote of the runs counts more.',
    },
  },
  breakShare: {
    key: 'breakShare',
    label: 'Break share',
    min: 0.02,
    max: 0.5,
    step: 0.01,
    format: (value) => `${value.toFixed(2)} (1 in ${oneIn(value)} digits)`,
    help: {
      what: 'The share of intervals that are breaks, before an interval says anything: the prior of each run’s P(break).',
      why: 'How likely an interval is a break depends on how common breaks are, not only on how long it is. The run you’re typing takes how often your runs break at the place instead, so this matters most for your first run.',
      moving:
        'Higher makes shorter pauses count as breaks, so more and smaller groups. Lower asks for longer pauses.',
    },
  },
  fullTrustUnevenness: {
    key: 'fullTrustUnevenness',
    label: 'Unevenness for full trust',
    min: 0.02,
    max: 1,
    step: 0.02,
    format: (value) => value.toFixed(2),
    help: {
      what: 'Each run’s P(break) at a place counts in how often your runs break there with a trust from 0 to 1, besides its recency: how uneven the run is around the place, the spread of its neighbors in log-interval. At this unevenness, the run is fully trusted. 0.1 means times vary by about 10% (a metronome), 0.6 by about 80% (clear pauses).',
      why: 'Where you type like a metronome, a break is just noise, and a steady run says little about your groups: once you’re fluent enough to type a stretch in one stream, its groups are kept rather than erased.',
      moving:
        'Lower trusts runs sooner, so steady stretches count as much as structured ones. Higher only trusts clearly structured stretches, so the trust horizon comes sooner. It never moves a run’s own breaks.',
    },
  },
} satisfies Record<
  'spreadFloor' | 'breakShift' | 'breakShare' | 'fullTrustUnevenness',
  Hyperparameter
>;

const H = HYPERPARAMETERS;

/** Terra, as developer mode picks and tunes it. */
export const TERRA: BreakModelKind = {
  id: 'terra',
  label: 'Terra',
  description:
    'Each run’s breaks against the pace and spread around them in that run, then how often the runs break at each place.',
  defaults: TERRA_DEFAULTS,
  // How each run is judged, how the runs are weighed, then how breaks make groups. Four at most to a tab, so that none
  // of them need scrolling.
  tabs: [
    {
      name: 'Breaks',
      hyperparameters: [
        H.window,
        TERRA_HYPERPARAMETERS.spreadFloor,
        TERRA_HYPERPARAMETERS.breakShift,
        TERRA_HYPERPARAMETERS.breakShare,
      ],
    },
    {
      name: 'Weights',
      hyperparameters: [H.recencyDecay, TERRA_HYPERPARAMETERS.fullTrustUnevenness],
    },
    {
      name: 'Groups',
      hyperparameters: [H.breakThreshold, H.usualThreshold, H.level, H.startingSlots],
    },
  ],
  create: (tuned) => terraModel(withDefaults(tuned)),
  steps: (tuned, finished) => {
    const settings = withDefaults(tuned);
    return terra(
      finished.map((times) => judge(times, settings)),
      undefined,
      settings,
    );
  },
};

/** Terra's hyperparameters, each one not tuned at its default. */
function withDefaults(tuned: Settings): TerraSettings {
  return { ...TERRA_DEFAULTS, ...tuned };
}
