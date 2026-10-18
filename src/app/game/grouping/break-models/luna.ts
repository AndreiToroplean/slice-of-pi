import type { BreakModelKind, Settings, Values } from './break-model';
import { BreakSettings, HYPERPARAMETERS } from './hyperparameters';
import { MERCURY_DEFAULTS } from './mercury';
import { modelFromSteps } from './model-from-steps';
import { neighborsOf } from './statistics';
import { groupsOf, Steps, trustOf } from './steps';

/**
 * Luna: each run is judged on its own first, at every place, whether the time the player took there is a pause (a break
 * between groups), and how much to trust that verdict. Then the runs vote, place by place, recent runs weighing more,
 * and the places where most of the votes say break are the usual break spots.
 *
 * A pause is judged against the local pace, the weighted average time of the neighbors, and their spread around it:
 * against the whole run's average, the slow end of what the player knows would look like pauses everywhere. A verdict
 * is trusted as much as the run is uneven there, since where the player types like a metronome, a break is just noise.
 *
 * The confidence and trust horizon come from the vote as in Mercury (`mercury.ts`), each run weighing its recency times
 * its trust there.
 *
 * Its steps are in the terms every break model's are: a run's baseline is its local pace, and its P(break) at a place
 * its verdict, 1 or 0. Nothing here is stored; it's always computed from the times of the runs.
 */

/**
 * Luna's hyperparameters, to be tuned by play testing. The window is the span of the neighbors of a place, centered on
 * it.
 */
export type LunaSettings = Pick<BreakSettings, 'window' | 'recencyDecay' | 'level'> &
  Readonly<{
    /** How many local spreads above the local pace a time must be to count as a pause. */
    pauseMargin: number;
    /** The shortest pause, as a multiple of the local pace. */
    minimumPause: number;
    /** The local unevenness (spread divided by pace) at which a run's verdict is fully trusted. */
    fullTrustUnevenness: number;
  }>;

export const LUNA_DEFAULTS: LunaSettings = {
  window: MERCURY_DEFAULTS.window,
  pauseMargin: 0.8,
  minimumPause: 1.35,
  fullTrustUnevenness: 0.6,
  recencyDecay: MERCURY_DEFAULTS.recencyDecay,
  level: MERCURY_DEFAULTS.level,
};

/**
 * What Luna decides by: a run's verdict is a break or not, a place is a usual break spot where most of the votes say
 * break, and a group past the trust horizon starts with 5 slots.
 */
const DECIDING = { breakThreshold: 0.5, usualThreshold: 0.5, startingSlots: 5 } as const;

/** With fewer neighbors than this, a run is too short to judge: it falls back on a fixed pause and a middling trust. */
const MINIMUM_NEIGHBORS = 3;
const FALLBACK_PAUSE = 900;
const FALLBACK_TRUST = 0.5;

/** One run's verdict at one place. */
export interface Verdict {
  /** The time the player took to type this digit after the one before, in milliseconds. */
  readonly time: number;
  /** The local pace: the weighted average time of the neighbors, in milliseconds; `undefined` if too few. */
  readonly pace: number | undefined;
  readonly isBreak: boolean;
  /** How much this verdict counts in the vote, from 0 to 1. */
  readonly trust: number;
}

/**
 * Judges every place of one run, from its times (in milliseconds since its first digit), by index: index 0 has no
 * verdict.
 */
export function verdictsOf(
  times: readonly number[],
  settings: LunaSettings,
): (Verdict | undefined)[] {
  const intervals = times.map((time, i) => time - (times[i - 1] ?? time));
  return intervals.map((time, i) => {
    if (i === 0) {
      return undefined;
    }
    // Index 0 has no interval. The weighted mean of the neighbors is the pace.
    const { mean: pace, spread, count } = neighborsOf(intervals, i, settings.window, 1);
    if (count < MINIMUM_NEIGHBORS) {
      return { time, pace: undefined, isBreak: time > FALLBACK_PAUSE, trust: FALLBACK_TRUST };
    }
    const threshold = Math.max(pace + settings.pauseMargin * spread, pace * settings.minimumPause);
    const unevenness = pace > 0 ? spread / pace : 0;
    return {
      time,
      pace,
      isBreak: time > threshold,
      trust: Math.min(1, unevenness / settings.fullTrustUnevenness),
    };
  });
}

/**
 * The runs' vote, from the verdicts of the finished runs, oldest first, and, if given, the times of the run in progress
 * (in milliseconds since its first digit), which is then the newest.
 */
export function luna(
  finished: readonly (readonly (Verdict | undefined)[])[],
  current: readonly number[] | undefined,
  settings: LunaSettings,
): Steps {
  const runs = current === undefined ? finished : [...finished, verdictsOf(current, settings)];
  const length = Math.max(0, ...runs.map((run) => run.length));
  const usual: (number | undefined)[] = [undefined];
  const coverage: (number | undefined)[] = [undefined];
  const breaks: number[] = [];
  const speedCurve: (number | undefined)[] = [undefined];
  const averageTime: (number | undefined)[] = [undefined];
  for (let i = 1; i < length; i++) {
    let votes = 0;
    let breakVotes = 0;
    let reached = 0;
    let times = 0;
    let paced = 0;
    let paces = 0;
    runs.forEach((run, r) => {
      const place = run[i];
      if (place === undefined) {
        return;
      }
      const recency = settings.recencyDecay ** (runs.length - 1 - r);
      votes += recency * place.trust;
      breakVotes += place.isBreak ? recency * place.trust : 0;
      reached += recency;
      times += recency * place.time;
      if (place.pace !== undefined) {
        paced += recency;
        paces += recency * place.pace;
      }
    });
    const breakShare = votes > 0 ? breakVotes / votes : 0;
    usual.push(breakShare);
    coverage.push(votes);
    breaks.push(breakVotes);
    speedCurve.push(paced > 0 ? paces / paced : undefined);
    averageTime.push(times / reached);
  }
  const trust = trustOf(usual, breaks, coverage, { ...settings, ...DECIDING });
  return {
    settings: { ...settings, ...DECIDING },
    runs: runs.map((run) => ({
      baseline: run.map((place) => place?.pace),
      breakProbability: run.map((place) =>
        place === undefined ? undefined : Number(place.isBreak),
      ),
      residual: run.map((place) => residualOf(place)),
    })),
    usual,
    coverage,
    ...trust,
    speedCurve,
    averageTime,
    groups: groupsOf(usual, DECIDING.usualThreshold, length, trust.horizon),
  };
}

/** The log of a time over its pace, where it has one. */
function residualOf(place: Verdict | undefined): Values[number] {
  return place?.pace === undefined || place.pace <= 0
    ? undefined
    : Math.log(Math.max(1, place.time) / place.pace);
}

/** Luna, as developer mode picks and tunes it. */
export const LUNA: BreakModelKind = {
  id: 'luna',
  label: 'Luna',
  description:
    'Each run’s pauses against the pace around them, then a vote of the runs at each place.',
  defaults: LUNA_DEFAULTS,
  // How each run is judged, then how the runs vote. Four at most to a tab, so that none of them need scrolling.
  tabs: [
    {
      name: 'Pauses',
      hyperparameters: [
        HYPERPARAMETERS.window,
        {
          key: 'pauseMargin',
          label: 'Pause margin',
          min: 0.1,
          max: 2.5,
          step: 0.05,
          format: (value) => `${value.toFixed(2)} spreads`,
          help: {
            what: 'Besides the pace, the model measures how much the neighbors’ times vary around it: their spread (standard deviation). A time is a pause when it’s longer than the pace plus this many spreads.',
            why: 'How surprising a delay is depends on how irregular you are there: 300 ms is a big surprise if you always take 200 ± 10, and nothing if you swing between 100 and 400. The standard deviation is that typical swing, in milliseconds like the times, so it adds to the pace (the variance is the same thing squared, in ms²).',
            moving:
              'Higher finds fewer breaks, so bigger groups: groups split by short pauses merge. Lower finds more breaks and smaller groups, false ones from a single slow keystroke included. The spread counts your other pauses too, so where you pause every 3 digits, 0.8 already asks for about 2.5 times your typing time.',
          },
        },
        {
          key: 'minimumPause',
          label: 'Minimum pause',
          min: 1,
          max: 3,
          step: 0.05,
          format: (value) => `${value.toFixed(2)} × pace`,
          help: {
            what: 'Whatever the spread says, a pause must also be at least this many times the pace.',
            why: 'Where you type steadily, the spread is tiny, so the pace plus the margin is barely above the pace, and any slightly slow keystroke would be a break. It’s a ratio rather than milliseconds because an extra 50 ms is a lot for a fast player and nothing for a slow one.',
            moving:
              'Higher keeps steady stretches as one long group, and drops short pauses everywhere once it’s above the pace plus the margin. Lower lets noise cut up steady stretches. It decides where you type steadily, and the margin where you pause regularly.',
          },
        },
        {
          key: 'fullTrustUnevenness',
          label: 'Unevenness for full trust',
          min: 0.1,
          max: 1.5,
          step: 0.05,
          format: (value) => value.toFixed(2),
          help: {
            what: 'Each run’s verdict at a place, break or not, counts in the vote with a trust from 0 to 1. It grows with how uneven the run’s rhythm is there: the spread divided by the pace. At this unevenness, the run is fully trusted.',
            why: 'Divided by the pace so that it measures rhythm, not speed: a player twice as fast with the same rhythm has half the spread in milliseconds. 0.1 means times vary by about 10% (a metronome), 0.6 by 60% (clear pauses). Where you type like a metronome, a break is just noise, and a steady run says little about your groups: once you’re fluent enough to type a stretch in one stream, its groups are kept rather than erased.',
            moving:
              'Lower trusts runs sooner, so your groups are followed further, noisier places included, and smooth runs erase groups sooner. Higher only trusts clearly structured stretches, so the trust horizon comes sooner. It never moves a run’s own breaks.',
          },
        },
      ],
    },
    {
      name: 'Vote',
      hyperparameters: [HYPERPARAMETERS.recencyDecay, HYPERPARAMETERS.level],
    },
  ],
  create: (tuned) => {
    const settings = withDefaults(tuned);
    return modelFromSteps((finished) => {
      const done = finished.map((times) => verdictsOf(times, settings));
      return (current) => luna(done, current, settings);
    });
  },
  steps: (tuned, finished) => {
    const settings = withDefaults(tuned);
    return luna(
      finished.map((times) => verdictsOf(times, settings)),
      undefined,
      settings,
    );
  },
};

/** Luna's hyperparameters, each one not tuned at its default. */
function withDefaults(tuned: Settings): LunaSettings {
  return { ...LUNA_DEFAULTS, ...tuned };
}
