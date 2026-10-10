/**
 * The timing model (`groupings.md` §4): finds the player's groups from the raw timings of their runs.
 *
 * Each run is judged on its own first: at every place, whether the time the player took there is a pause (a break
 * between groups), and how much to trust that verdict. Then the runs vote, place by place, recent runs weighing more,
 * and the aggregate breaks cut the digits into groups. Nothing here is stored; it's always computed from the timings.
 *
 * Places are indexed like the digits of a run: index 0 is the first digit typed. The verdict at index i is about the
 * boundary just before digit i, so index 0 never has one.
 */

/** The constants of the model, to be tuned by play testing. */
export interface TimingSettings {
  /** How far around a digit its neighbors reach, in digits: the standard deviation of their bell-curve weights. */
  readonly neighborhood: number;
  /** How many local spreads above the local pace a time must be to count as a pause. */
  readonly pauseMargin: number;
  /** The shortest pause, as a multiple of the local pace. */
  readonly minimumPause: number;
  /** The local unevenness (spread divided by pace) at which a run's verdict is fully trusted. */
  readonly fullTrustUnevenness: number;
  /** How many runs back a run's vote weighs half as much as the newest run's. */
  readonly halfLife: number;
  /** How much trusted evidence makes the aggregate 63% sure, in fully trusted newest runs. */
  readonly evidenceNeeded: number;
  /** The aggregate confidence a group needs for the hint to follow it, from 0 to 1. */
  readonly hintConfidence: number;
}

export const DEFAULT_TIMING_SETTINGS: TimingSettings = {
  neighborhood: 4,
  pauseMargin: 0.8,
  minimumPause: 1.35,
  fullTrustUnevenness: 0.6,
  halfLife: 16,
  evidenceNeeded: 1.2,
  hintConfidence: 0.45,
};

/** Neighbors further than this many neighborhoods away are left out: their weight would be under 1.2%. */
const CUTOFF = 3;
/** With fewer neighbors than this, a run is too short to judge: it falls back on a fixed pause and a middling trust. */
const MINIMUM_NEIGHBORS = 3;
const FALLBACK_PAUSE = 900;
const FALLBACK_TRUST = 0.5;

/** One run's verdict at one place. */
export interface RunPlace {
  /** The time the player took to type this digit after the one before, in milliseconds. */
  readonly time: number;
  /** The local pace: the weighted average time of the neighbors, in milliseconds; `undefined` if too few. */
  readonly pace: number | undefined;
  /** The time above which this one is a pause, in milliseconds. */
  readonly threshold: number;
  readonly isBreak: boolean;
  /** How much this verdict counts in the vote, from 0 to 1. */
  readonly trust: number;
}

/** The aggregate's verdict at one place. */
export interface AggregatePlace {
  /** The recency-weighted average time at this place, in milliseconds, for display only. */
  readonly time: number;
  /** The weighted share of the runs' votes that say break, from 0 to 1. */
  readonly breakShare: number;
  readonly isBreak: boolean;
  /** How sure the aggregate is of its verdict here, break or not, from 0 to 1. */
  readonly confidence: number;
}

/** A group of digits found by the aggregate. */
export interface Group {
  /** The index of its first digit. */
  readonly start: number;
  readonly size: number;
  /** The average confidence of the verdicts that make it: no break inside it, a break at its end. */
  readonly confidence: number;
  /** Whether it runs to the end of the data, with no break known to end it (its confidence is then 0). */
  readonly open: boolean;
}

export interface Aggregate {
  /** By index; `undefined` at index 0 and where no run has a verdict. */
  readonly places: readonly (AggregatePlace | undefined)[];
  readonly groups: readonly Group[];
}

/** Judges every place of one run, from its times (in milliseconds since its first digit). */
export function analyzeRun(
  times: readonly number[],
  settings: TimingSettings,
): (RunPlace | undefined)[] {
  const intervals = times.map((time, i) => time - (times[i - 1] ?? time));
  return intervals.map((time, i) => {
    if (i === 0) {
      return undefined;
    }
    const local = neighbors(intervals, i, settings.neighborhood);
    if (local.count < MINIMUM_NEIGHBORS) {
      return {
        time,
        pace: undefined,
        threshold: FALLBACK_PAUSE,
        isBreak: time > FALLBACK_PAUSE,
        trust: FALLBACK_TRUST,
      };
    }
    const threshold = Math.max(
      local.pace + settings.pauseMargin * local.spread,
      local.pace * settings.minimumPause,
    );
    const unevenness = local.pace > 0 ? local.spread / local.pace : 0;
    return {
      time,
      pace: local.pace,
      threshold,
      isBreak: time > threshold,
      trust: Math.min(1, unevenness / settings.fullTrustUnevenness),
    };
  });
}

/**
 * The weighted mean (pace) and standard deviation (spread) of the intervals around index i, leaving i itself out so a
 * pause never raises its own bar. Index 0 has no interval.
 */
function neighbors(
  intervals: readonly number[],
  i: number,
  neighborhood: number,
): { pace: number; spread: number; count: number } {
  const reach = Math.ceil(CUTOFF * neighborhood);
  let weights = 0;
  let sum = 0;
  let sumOfSquares = 0;
  let count = 0;
  for (let j = Math.max(1, i - reach); j <= Math.min(intervals.length - 1, i + reach); j++) {
    const interval = intervals[j];
    if (j === i || interval === undefined) {
      continue;
    }
    const weight = Math.exp(-((j - i) ** 2) / (2 * neighborhood ** 2));
    weights += weight;
    sum += weight * interval;
    sumOfSquares += weight * interval ** 2;
    count++;
  }
  if (count === 0) {
    return { pace: 0, spread: 0, count };
  }
  const pace = sum / weights;
  return { pace, spread: Math.sqrt(Math.max(0, sumOfSquares / weights - pace ** 2)), count };
}

/** How much a run's vote weighs, `age` runs back from the newest (age 0). */
export function recencyWeight(age: number, settings: TimingSettings): number {
  return 2 ** (-age / settings.halfLife);
}

/** Combines the verdicts of the runs, given oldest first as returned by {@link analyzeRun}, into groups. */
export function aggregate(
  runs: readonly (readonly (RunPlace | undefined)[])[],
  settings: TimingSettings,
): Aggregate {
  const length = Math.max(0, ...runs.map((run) => run.length));
  const places = Array.from({ length }, (_, i): AggregatePlace | undefined => {
    let votes = 0;
    let breakVotes = 0;
    let timeWeights = 0;
    let times = 0;
    runs.forEach((run, r) => {
      const place = run[i];
      if (place === undefined) {
        return;
      }
      const recency = recencyWeight(runs.length - 1 - r, settings);
      votes += recency * place.trust;
      breakVotes += place.isBreak ? recency * place.trust : 0;
      timeWeights += recency;
      times += recency * place.time;
    });
    if (timeWeights === 0) {
      return undefined;
    }
    const breakShare = votes > 0 ? breakVotes / votes : 0;
    const agreement = Math.abs(2 * breakShare - 1);
    const evidence = 1 - Math.exp(-votes / settings.evidenceNeeded);
    return {
      time: times / timeWeights,
      breakShare,
      isBreak: breakShare > 0.5,
      confidence: agreement * evidence,
    };
  });
  return { places, groups: groups(places) };
}

function groups(places: readonly (AggregatePlace | undefined)[]): Group[] {
  const found: Group[] = [];
  let start = 0;
  for (let i = 1; i <= places.length; i++) {
    const open = i === places.length;
    if (!open && places[i]?.isBreak !== true) {
      continue;
    }
    const verdicts = places.slice(start + 1, i + 1).flatMap((place) => place?.confidence ?? []);
    const confidence =
      open || verdicts.length === 0 ? 0 : verdicts.reduce((a, b) => a + b, 0) / verdicts.length;
    found.push({ start, size: i - start, confidence, open });
    start = i;
  }
  return found;
}

/** Whether the hint follows this group (`groupings.md` §4.3); elsewhere it's the default of 5. */
export function isConfident(group: Group, settings: TimingSettings): boolean {
  return !group.open && group.confidence >= settings.hintConfidence;
}
