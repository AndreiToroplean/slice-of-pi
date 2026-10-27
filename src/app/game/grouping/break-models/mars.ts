import type { BreakModel, BreakModelKind, Settings } from './break-model';
import {
  ENVELOPE_DEFAULTS,
  ENVELOPE_HYPERPARAMETERS,
  enveloped,
  Enveloped,
  envelopeIn,
  EnvelopeSettings,
  isFlat,
  Played,
} from './envelope';
import { HYPERPARAMETERS } from './hyperparameters';
import { logistic, logit } from './statistics';
import { groupEnds, modelFromSteps } from './model-from-steps';
import {
  breakSums,
  BreakSums,
  byIndex,
  groupsBetween,
  groupsOf,
  longestOf,
  RunSteps,
  Steps,
  trustOf,
  usualOf,
} from './steps';
import {
  Judged,
  judge,
  JudgedRun,
  judgedWorkings,
  paceOf,
  PaceSums,
  paceSums,
  TERRA_HYPERPARAMETERS,
  TerraSettings,
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
 *    ends at once where the runs usually break. The group-size envelope (`envelope.ts`) adds its own evidence at each
 *    place, weighed over all the places at once, so that groups too small or too big are less likely, or never: as
 *    it's played, it takes the groups before the one being typed as they were played.
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
  EnvelopeSettings &
  Readonly<{
    /** The unevenness a run is taken to have around a place before its neighbors say, in log-interval. */
    priorUnevenness: number;
    /** How much the trust counts, from 0 (every run weighs its recency alone) to 1 (its recency times its trust). */
    trustInfluence: number;
    /**
     * The recency decay from the run being typed to the newest recorded run: the run being typed counts 1, the newest
     * recorded run this, and each before it `recencyDecay` times the one after it. Without a run being typed, as on the
     * pages of the runs, the newest recorded run counts 1, so this changes nothing there.
     */
    currentDecay: number;
  }>;

/** How many neighbors' worth the prior unevenness weighs against a place's own neighbors. */
const PRIOR_NEIGHBORS = 2;

/**
 * Tuned by the owner's play testing, the level at 0 so that the game follows the groups wherever a run reached: from
 * the second run on, it plays the player's own groups.
 */
export const MARS_DEFAULTS: MarsSettings = {
  window: 9,
  recencyDecay: 0.96,
  spreadFloor: 0.2,
  breakShift: 2.3,
  breakShare: 0.2,
  fullTrustUnevenness: 0.3,
  breakThreshold: 0.25,
  level: 0,
  startingSlots: 5,
  priorUnevenness: 0.2,
  trustInfluence: 1,
  currentDecay: 0.5,
  ...ENVELOPE_DEFAULTS,
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
  return marsOver(finished, settings)(current);
}

/**
 * {@link mars} over the judged finished runs, for any run in progress: what the finished runs add up to with one is
 * worked out once, so that each run in progress only adds its own share to it, as the game asks about the same run
 * again and again with its next digit timed differently. With the index where its group being typed starts, the groups
 * before it are taken as played.
 */
export function marsOver(
  finished: readonly JudgedRun[],
  settings: MarsSettings,
): (current?: readonly number[], start?: number) => Steps {
  const decays = (count: number): number[] => recencyOf(count, settings);
  let withCurrent: Pool | undefined;
  return (current, start) => {
    if (current === undefined) {
      const recency = decays(finished.length);
      const pool = pooled(undefined, finished, recency, recency, settings);
      return stepsOf(pool, settings, envelopeOver(pool, settings));
    }
    // The run being typed counts 1, the newest finished run the current decay, each before it fading as usual; the
    // pace weighs every run by its recency alone, the run being typed the newest.
    withCurrent ??= pooled(
      undefined,
      finished,
      decays(finished.length).map((decay) => settings.currentDecay * decay),
      decays(finished.length + 1),
      settings,
    );
    const pool = pooled(withCurrent, [judge(current, settings)], [1], [1], settings);
    const played = start === undefined ? undefined : { start, last: current.length - 1 };
    return stepsOf(pool, settings, envelopeOver(pool, settings, played));
  };
}

/** The recency of each of `count` runs, oldest first, the newest counting 1. */
function recencyOf(count: number, settings: MarsSettings): number[] {
  return Array.from({ length: count }, (_, k) => settings.recencyDecay ** (count - 1 - k));
}

/**
 * {@link mars} over the judged finished runs alone, with what it works out on the way (`workings.ts`), for developer
 * mode to show.
 */
export function marsSteps(finished: readonly JudgedRun[], settings: MarsSettings): Steps {
  const recency = recencyOf(finished.length, settings);
  const pool = pooled(undefined, finished, recency, recency, settings);
  const shaped = envelopeOver(pool, settings);
  const prior = logit(settings.breakShare);
  const threshold = logit(settings.breakThreshold);
  const workings = judgedWorkings(finished, recency, (at) => trustOfPlace(at, settings), settings);
  const envelope = byIndex(pool.logOdds.map((_, p) => shaped?.evidence[p + 1] ?? 0));
  // Each run's own breaks, as the envelope weighs them over that run alone.
  const runBreaks =
    shaped === undefined
      ? undefined
      : finished.map(
          (run) =>
            enveloped(
              byIndex(run.places.map((at) => prior + at.evidence - threshold)),
              run.digits,
              envelopeIn(settings),
            )?.breaks ?? [],
        );
  return {
    ...stepsOf(pool, settings, shaped),
    workings: {
      ...workings,
      pool: {
        prior,
        threshold,
        logOdds: byIndex(pool.logOdds),
        envelope,
        ...(runBreaks === undefined ? {} : { runBreaks }),
        agreement: usualOf(pool.breaks).usual,
        // The next run counts 1, and the finished runs the current decay times what they count here: its evidence
        // makes up the rest, straight in z, the envelope's as it stands.
        nextRunZ: byIndex(
          pool.logOdds.map(
            (logOdds, p) =>
              workings.evenZ +
              (threshold -
                (envelope[p + 1] ?? 0) -
                prior -
                settings.currentDecay * (logOdds - prior)) /
                settings.breakShift,
          ),
        ),
      },
    },
  };
}

/**
 * What the group-size envelope (`envelope.ts`) makes of the breaks of the runs pooled, given the group being typed if
 * any: nothing if it changes nothing, at 1 for every size, or if no grouping fits it.
 */
function envelopeOver(pool: Pool, settings: MarsSettings, played?: Played): Enveloped | undefined {
  const envelope = envelopeIn(settings);
  if (isFlat(envelope)) {
    return undefined;
  }
  const threshold = logit(settings.breakThreshold);
  return enveloped(
    byIndex(pool.logOdds.map((logOdds) => logOdds - threshold)),
    digitsOf(pool),
    envelope,
    played,
  );
}

/** How many digits the longest run pooled has. */
function digitsOf(pool: Pool): number {
  return Math.max(0, ...pool.runs.map((run) => run.digits));
}

/** What the runs pooled add up to at each place, and each of them, so that more runs can be added. */
interface Pool {
  readonly runs: readonly JudgedRun[];
  readonly weights: readonly Float64Array[];
  readonly steps: readonly RunSteps[];
  /** The log-odds of a break: the prior, plus each run's evidence times its weight. */
  readonly logOdds: readonly number[];
  /** The runs' own verdicts, to tell how many agree with the evidence pooled. */
  readonly breaks: BreakSums;
  readonly pace: PaceSums;
}

/**
 * The runs added to the pool `from`, if any, in order, each weighing its recency (times its trust at each place) in the
 * evidence and its pace recency in the pace.
 */
function pooled(
  from: Pool | undefined,
  runs: readonly JudgedRun[],
  recency: readonly number[],
  paceRecency: readonly number[],
  settings: MarsSettings,
): Pool {
  const prior = logit(settings.breakShare);
  const weights = runs.map((run, k) =>
    Float64Array.from(run.places, (at) => (recency[k] ?? 0) * trustOfPlace(at, settings)),
  );
  const steps = runs.map((run): RunSteps => ({
    baseline: byIndex(run.places.map((at) => at.pace)),
    breakProbability: byIndex(run.places.map((at) => logistic(prior + at.evidence))),
    residual: byIndex(
      run.places.map((at) => (at.pace === undefined ? undefined : Math.log(at.time / at.pace))),
    ),
  }));
  const logs = runs.map((run) => run.logs);
  return {
    runs: [...(from?.runs ?? []), ...runs],
    weights: [...(from?.weights ?? []), ...weights],
    steps: [...(from?.steps ?? []), ...steps],
    logOdds: Array.from({ length: Math.max(from?.logOdds.length ?? 0, longestOf(logs)) }, (_, p) =>
      runs.reduce(
        (sum, run, k) => sum + (weights[k]?.[p] ?? 0) * (run.places[p]?.evidence ?? 0),
        from?.logOdds[p] ?? prior,
      ),
    ),
    breaks: breakSums(logs, steps, weights, undefined, from?.breaks),
    pace: paceSums(runs, paceRecency, from?.pace),
  };
}

/**
 * The steps of the runs pooled, with what the envelope makes of them, if anything: its evidence counts in the
 * usual-break probability, so in the groups, but not in the confidence, which is in the runs alone, as the envelope
 * says nothing of them.
 */
function stepsOf(pool: Pool, settings: MarsSettings, shaped: Enveloped | undefined): Steps {
  const usual = byIndex(
    pool.logOdds.map((logOdds, p) => logistic(logOdds + (shaped?.evidence[p + 1] ?? 0))),
  );
  const { coverage, breaks, averageTime } = usualOf(pool.breaks);
  const trust = trustOf(byIndex(pool.logOdds.map(logistic)), breaks, coverage, {
    usualThreshold: settings.breakThreshold,
    level: settings.level,
  });
  const digits = digitsOf(pool);
  return {
    // One threshold for every break: where the runs usually break is where they break, pooled.
    settings: { ...settings, usualThreshold: settings.breakThreshold },
    runs: pool.steps,
    usual,
    coverage,
    ...trust,
    speedCurve: paceOf(pool.pace),
    averageTime,
    // The envelope's own breaks rather than the probability's over the threshold, which they only miss on a tie.
    groups:
      shaped === undefined
        ? groupsOf(usual, settings.breakThreshold, digits, trust.horizon)
        : groupsBetween(shaped.breaks, digits, trust.horizon),
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

/**
 * Mars as the game sees it. The run being typed is pooled with the others, so every group ends where the usual-break
 * probability is over the break threshold, within the trust horizon or past it.
 */
function marsModel(settings: MarsSettings): BreakModel {
  return modelFromSteps(
    (finished) => {
      const over = marsOver(
        finished.map((times) => judge(times, settings)),
        settings,
      );
      return (current, _init, start) => over(current, start);
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
  // How each run is judged, how the runs are weighed by recency and by trust, then how breaks make groups, of which
  // sizes.
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
          min: 0.01,
          max: 1,
          step: 0.01,
          format: (value) => value.toFixed(2),
          help: {
            what: 'The recency decay from the run you’re typing to your newest recorded run, where the recency decay above is between recorded runs: the run you’re typing counts 1, your newest recorded run this much, and each one before it the recency decay times the one after it. It only counts as you play: on Model Tuning, no run is being typed.',
            why: 'The run you’re typing tells best how you group right now, so a pause in it can count for more than one in any run before, while how much is tuned apart from how your recorded runs fade.',
            moving:
              'Lower lets the run you’re typing count for more, so a pause ends a group sooner where your earlier runs carried on, and a run-through undoes a usual break spot sooner. At the recency decay, it counts just as a run newer than the newest would; at 1, as much as the newest.',
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
            what: 'Each run’s evidence at a place counts with a trust from 0 to 1, besides its recency: how uneven the run is around the place, the spread of its neighbors in log-interval. At this unevenness, the run is fully trusted. At 0.1, times are typically within a factor of about 1.1 of the pace (a metronome); at 0.6, within a factor of about 1.8 (clear pauses).',
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
    { name: 'Envelope', hyperparameters: ENVELOPE_HYPERPARAMETERS },
  ],
  create: (tuned) => marsModel(withDefaults(tuned)),
  steps: (tuned, finished) => {
    const settings = withDefaults(tuned);
    return marsSteps(
      finished.map((times) => judge(times, settings)),
      settings,
    );
  },
};

/** Mars's hyperparameters, each one not tuned at its default. */
function withDefaults(tuned: Settings): MarsSettings {
  return { ...MARS_DEFAULTS, ...tuned };
}
