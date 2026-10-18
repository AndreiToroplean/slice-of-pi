import type { BreakModel, BreakModelKind, Settings } from './break-model';
import { HYPERPARAMETERS } from './hyperparameters';
import { groupEnds, modelFromSteps } from './model-from-steps';
import { byIndex, groupsOf, longestOf, RunSteps, Steps, trustOf, usualBreaks } from './steps';
import {
  judge,
  JudgedRun,
  TERRA_DEFAULTS,
  TERRA_HYPERPARAMETERS,
  TerraSettings,
  usualPace,
} from './terra';

/**
 * Mars: Terra (`terra.ts`) pooling what the runs say rather than what they conclude. Terra averages each run's P(break)
 * at a place, a verdict from 0 to 1, so a run never weighs more than its share: where a few runs carried on, one long
 * pause can't make a break, and where they broke, one fast run-through can't undo it. Mars adds up each run's evidence
 * instead, the log of how much likelier its interval is for a break than for a normal one, which has no bounds.
 *
 * 1. Each run is judged as in Terra, against the pace and spread around each interval in that run: its z there. Its
 *    evidence is a straight line in z, so in the log of the interval: halving the interval counts as much against a
 *    break as doubling it counts for one. Unlike Terra, an interval faster than its pace isn't cut to "no break": it
 *    says so, the more surely the faster it is.
 * 2. The evidence of every run at a place is added up, each weighing its recency times its trust there, as in Terra,
 *    on top of the break share, the prior, counted once. That's the log-odds of a break at the place, and the
 *    usual-break probability. Adding up the evidence is averaging the runs' z, so the runs are pooled before being
 *    judged, as in Venus (`venus.ts`), but in each run's own terms rather than in milliseconds.
 * 3. One threshold, the break threshold, makes the usual break spots, so the groups, and ends every group as it's
 *    played: the run being typed counts like any other, its next digit timed as if typed now. Its evidence rises with
 *    the wait, so a long enough pause ends a group anywhere, the longer the more runs carried on there; and the group
 *    ends at once where the runs usually break.
 * 4. The confidence is how surely enough runs agree with the verdict at a place, as in Mercury: the weighted share of
 *    runs whose own P(break) there says break, with the break share as the prior, against the threshold. So one run's
 *    long pause can make a break, but not one the game trusts.
 *
 * Nothing here is stored; it's always computed from the times of the runs.
 */

/** Mars's hyperparameters: Terra's, with one threshold for every break. */
export type MarsSettings = Omit<TerraSettings, 'usualThreshold'>;

/** Terra's, to start from until Mars is fitted. */
export const MARS_DEFAULTS: MarsSettings = {
  window: TERRA_DEFAULTS.window,
  recencyDecay: TERRA_DEFAULTS.recencyDecay,
  spreadFloor: TERRA_DEFAULTS.spreadFloor,
  breakShift: TERRA_DEFAULTS.breakShift,
  breakShare: TERRA_DEFAULTS.breakShare,
  fullTrustUnevenness: TERRA_DEFAULTS.fullTrustUnevenness,
  breakThreshold: TERRA_DEFAULTS.breakThreshold,
  level: TERRA_DEFAULTS.level,
  startingSlots: TERRA_DEFAULTS.startingSlots,
};

/**
 * Runs the model over the judged finished runs, oldest first, and, if given, the times of the run in progress (in
 * milliseconds since its first digit), which is then the newest.
 */
export function mars(
  finished: readonly JudgedRun[],
  current: readonly number[] | undefined,
  settings: MarsSettings,
): Steps {
  const runs = current === undefined ? finished : [...finished, judge(current, settings)];
  const prior = logit(settings.breakShare);
  const weights = runs.map((run, k) =>
    Float64Array.from(
      run.places,
      (at) => settings.recencyDecay ** (runs.length - 1 - k) * at.trust,
    ),
  );
  const runSteps = runs.map((run): RunSteps => ({
    baseline: byIndex(run.places.map((at) => at.pace)),
    breakProbability: byIndex(run.places.map((at) => logistic(prior + at.evidence))),
    residual: byIndex(
      run.places.map((at) => (at.pace === undefined ? undefined : Math.log(at.time / at.pace))),
    ),
  }));
  const logs = runs.map((run) => run.logs);
  const usual = byIndex(
    Array.from({ length: longestOf(logs) }, (_, p) =>
      logistic(
        runs.reduce(
          (sum, run, k) => sum + (weights[k]?.[p] ?? 0) * (run.places[p]?.evidence ?? 0),
          prior,
        ),
      ),
    ),
  );
  // The runs' own verdicts, to tell how many agree with the evidence pooled.
  const { coverage, breaks, averageTime } = usualBreaks(logs, runSteps, weights);
  const trust = trustOf(usual, breaks, coverage, {
    usualThreshold: settings.breakThreshold,
    level: settings.level,
  });
  return {
    // One threshold for every break: where the runs usually break is where they break, pooled.
    settings: { ...settings, usualThreshold: settings.breakThreshold },
    runs: runSteps,
    usual,
    coverage,
    ...trust,
    speedCurve: usualPace(runs, settings),
    averageTime,
    groups: groupsOf(
      usual,
      settings.breakThreshold,
      Math.max(0, ...runs.map((run) => run.digits)),
      trust.horizon,
    ),
  };
}

function logit(probability: number): number {
  return Math.log(probability / (1 - probability));
}

/** The probability of log-odds, without overflow however far they are from 0. */
function logistic(logOdds: number): number {
  return logOdds >= 0 ? 1 / (1 + Math.exp(-logOdds)) : Math.exp(logOdds) / (1 + Math.exp(logOdds));
}

/**
 * Mars as the game sees it. The run being typed is pooled with the others, so every group ends where the usual-break
 * probability is over the break threshold, within the trust horizon or past it.
 */
function marsModel(settings: MarsSettings): BreakModel {
  return modelFromSteps(
    (finished) => {
      const judged = finished.map((times) => judge(times, settings));
      return (current) => mars(judged, current, settings);
    },
    (steps, next) => groupEnds(steps, next, true),
  );
}

const H = HYPERPARAMETERS;
const T = TERRA_HYPERPARAMETERS;

/** Mars, as developer mode picks and tunes it. */
export const MARS: BreakModelKind = {
  id: 'mars',
  label: 'Mars',
  description:
    'Each run’s evidence for a break against the pace and spread around it in that run, added up over the runs at each place.',
  defaults: MARS_DEFAULTS,
  // How each run is judged, how the runs are weighed, then how breaks make groups, as in Terra.
  tabs: [
    {
      name: 'Breaks',
      hyperparameters: [
        H.window,
        T.spreadFloor,
        T.breakShift,
        {
          ...T.breakShare,
          help: {
            what: 'The share of intervals that are breaks, before any run says anything: the prior, to which the evidence of every run at a place is added.',
            why: 'How likely a place is a break depends on how common breaks are, not only on how long the runs paused there. It counts once, however many runs there are, so it matters most while you have few.',
            moving:
              'Higher makes shorter pauses count as breaks, so more and smaller groups. Lower asks for longer pauses.',
          },
        },
      ],
    },
    {
      name: 'Weights',
      hyperparameters: [
        H.recencyDecay,
        {
          ...T.fullTrustUnevenness,
          help: {
            what: 'Each run’s evidence at a place counts with a trust from 0 to 1, besides its recency: how uneven the run is around the place, the spread of its neighbors in log-interval. At this unevenness, the run is fully trusted. 0.1 means times vary by about 10% (a metronome), 0.6 by about 80% (clear pauses).',
            why: 'Where you type like a metronome, a break is just noise, and a steady run says little about your groups: once you’re fluent enough to type a stretch in one stream, its groups are kept rather than erased.',
            moving:
              'Lower trusts runs sooner, so steady stretches count as much as structured ones. Higher only trusts clearly structured stretches, so the trust horizon comes sooner. It never moves a run’s own breaks.',
          },
        },
      ],
    },
    {
      name: 'Groups',
      hyperparameters: [H.breakThreshold, H.level, H.startingSlots],
    },
  ],
  create: (tuned) => marsModel(withDefaults(tuned)),
  steps: (tuned, finished) => {
    const settings = withDefaults(tuned);
    return mars(
      finished.map((times) => judge(times, settings)),
      undefined,
      settings,
    );
  },
};

/** Mars's hyperparameters, each one not tuned at its default. */
function withDefaults(tuned: Settings): MarsSettings {
  return { ...MARS_DEFAULTS, ...tuned };
}
