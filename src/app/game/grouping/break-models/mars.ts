import type { BreakModel, BreakModelKind, Settings } from './break-model';
import type { Judged } from './terra';
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
 * 2. The evidence of every run at a place is added up, each weighing its recency times its trust there, on top of the
 *    break share, the prior, counted once. The trust is Terra's, how uneven the run is around the place, but that
 *    unevenness starts from a prior one, worth a few neighbors, so that a run's first intervals, with too few neighbors
 *    to tell, aren't taken for perfectly steady ones; and how much the trust counts at all is a hyperparameter. The run
 *    being typed, if any, counts 1, and the newest recorded run its own step down from it, the current decay; the
 *    recorded runs before it fade by the recency decay as usual. That's the log-odds of a break at the place, and the
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

/**
 * Mars's hyperparameters: Terra's, with one threshold for every break, two of its own for the trust, and one for how
 * much the run being typed counts.
 */
export type MarsSettings = Omit<TerraSettings, 'usualThreshold'> &
  Readonly<{
    /** The unevenness a run is taken to have around a place before its neighbors say, in log-interval. */
    priorUnevenness: number;
    /** How much the trust counts, from 0 (every run weighs its recency alone) to 1 (its recency times its trust). */
    trustInfluence: number;
    /**
     * The recency decay from the run being typed to the newest recorded run: the run being typed counts 1, the newest
     * recorded run this, and each before it `recencyDecay` times the one after it. Without a run being typed, as on
     * Your Runs, the newest recorded run counts 1, so this changes nothing there.
     */
    currentDecay: number;
  }>;

/** How many neighbors' worth the prior unevenness weighs against a place's own neighbors. */
const PRIOR_NEIGHBORS = 2;

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
  priorUnevenness: 0.2,
  trustInfluence: 1,
  currentDecay: 0.5,
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
  const weights = runs.map((run, k) => {
    const recency =
      current === undefined
        ? settings.recencyDecay ** (runs.length - 1 - k)
        : k === finished.length
          ? 1
          : settings.currentDecay * settings.recencyDecay ** (finished.length - 1 - k);
    return Float64Array.from(run.places, (at) => recency * trustOfPlace(at, settings));
  });
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

/**
 * How much a run's evidence at a place counts, from 0 to 1, besides its recency: as much as the run is uneven around
 * it, its neighbors' unevenness pooled with the prior one, up to full trust; then as much as the trust counts at all.
 */
function trustOfPlace(at: Judged, settings: MarsSettings): number {
  const variance =
    (at.neighbors * at.unevenness ** 2 + PRIOR_NEIGHBORS * settings.priorUnevenness ** 2) /
    (at.neighbors + PRIOR_NEIGHBORS);
  const trust = Math.min(1, Math.sqrt(variance) / settings.fullTrustUnevenness);
  return 1 - settings.trustInfluence * (1 - trust);
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
  // How each run is judged, how the runs are weighed by recency and by trust, then how breaks make groups.
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
      name: 'Recency',
      hyperparameters: [
        H.recencyDecay,
        {
          key: 'currentDecay',
          label: 'Current decay',
          min: 0.05,
          max: 1,
          step: 0.05,
          format: (value) => value.toFixed(2),
          help: {
            what: 'The recency decay from the run you’re typing to your newest recorded run, where the recency decay above is between recorded runs: the run you’re typing counts 1, your newest recorded run this much, and each one before it the recency decay times the one after it. It only counts as you play: on Your Runs, no run is being typed.',
            why: 'The run you’re typing tells best how you group right now, so a pause in it can count for more than one in any run before, while how much is tuned apart from how your recorded runs fade.',
            moving:
              'Lower lets the run you’re typing count for more, so a pause ends a group sooner where your earlier runs carried on, and a run-through undoes a usual break spot sooner. At 1, it counts just as a run newer than the newest would.',
          },
        },
      ],
    },
    {
      name: 'Trust',
      hyperparameters: [
        {
          ...T.fullTrustUnevenness,
          help: {
            what: 'Each run’s evidence at a place counts with a trust from 0 to 1, besides its recency: how uneven the run is around the place, the spread of its neighbors in log-interval. At this unevenness, the run is fully trusted. 0.1 means times vary by about 10% (a metronome), 0.6 by about 80% (clear pauses).',
            why: 'Where you type like a metronome, a break is just noise, and a steady run says little about your groups: once you’re fluent enough to type a stretch in one stream, its groups are kept rather than erased.',
            moving:
              'Lower trusts runs sooner, so steady stretches count as much as structured ones. Higher only trusts clearly structured stretches, so the trust horizon comes sooner. It never moves a run’s own breaks.',
          },
        },
        {
          key: 'priorUnevenness',
          label: 'Prior unevenness',
          min: 0,
          max: 1,
          step: 0.02,
          format: (value) => value.toFixed(2),
          help: {
            what: `How uneven a run is taken to be around a place before its neighbors there say, in log-interval: it counts as ${String(PRIOR_NEIGHBORS)} neighbors more, so it fades as real neighbors come.`,
            why: 'At the start of a run, a place has one or two neighbors, which can’t tell how uneven you are: without a prior, they’d look perfectly steady, and the run, the one you’re typing included, wouldn’t count there at all, so no pause could end a group.',
            moving:
              'Higher trusts a run’s first intervals more, so a pause early in a run ends a group sooner. Lower leaves them to their few neighbors.',
          },
        },
        {
          key: 'trustInfluence',
          label: 'Trust influence',
          min: 0,
          max: 1,
          step: 0.05,
          format: (value) => value.toFixed(2),
          help: {
            what: 'How much the trust counts in a run’s weight at a place: at 0, every run weighs its recency alone; at 1, its recency times its trust; in between, a run with no trust still weighs that much less than 1.',
            why: 'The trust keeps steady stretches from erasing your groups, but it also keeps a fluent run through a break spot from undoing it. Fitted, it tells whether the trust earns its place.',
            moving:
              'Lower lets steady runs count as much as uneven ones, so a fluent run-through merges groups sooner. Higher leaves your groups to the runs where you pause clearly.',
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
