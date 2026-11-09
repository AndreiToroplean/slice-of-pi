import type { GroupPlan } from '../groups';
import type { BreakModel, Gameplay, Stats, TimedRun } from './break-model';
import { timesFromPlace } from '../from-checkpoint';
import type { Mixture } from './statistics';
import { breaksOf, RunSteps, Steps } from './steps';

/**
 * Works out the steps over the finished runs it was given and, if given, the run in progress, which is then the newest:
 * its times since its first digit, at the place it was prepared for.
 * `init` is the last mixture fitted, if any, to start the fit from. `start`, with a run in progress, is the index where
 * its group being typed starts, which hasn't finished before its last digit: the groups before it are played, so a
 * model may take them as they are rather than as it would cut them.
 */
export type Fit = (current?: readonly number[], init?: Mixture, start?: number) => Steps;

/** Whether the group being typed is finished before the digit at index `next`, as {@link groupEnds} decides. */
export type Ends = (steps: Steps, next: number, trusted: boolean) => boolean;

/**
 * What fits the finished runs, oldest first, with a run in progress from the place `from` or without.
 */
export type Prepare = (finished: readonly TimedRun[], from: number) => Fit;

/**
 * The model the game sees, from a model that works out its steps (`steps.ts`): `prepare` gives what fits the finished
 * runs. `ends` decides where groups end, by default {@link groupEnds}.
 */
export function modelFromSteps(prepare: Prepare, ends: Ends = groupEnds): BreakModel {
  return {
    play: (finished, groupSize, from = 0) =>
      gameplayOf(prepare(finished, from), ends, groupSize, from),
    stats: (finished) => statsOf(prepare(finished, 0)()),
  };
}

/**
 * What a model that only takes runs from the start of π fits, from `prepare` given their times alone: finished runs
 * from a checkpoint are left out, each with no steps of its own, so that the steps' runs stay those given; the run in
 * progress from one is taken from the start of π, the places before it timed as an earlier run typed them (see
 * `timesFromPlace`).
 */
export function fromStartOfPiOnly(
  prepare: (finished: readonly (readonly number[])[]) => Fit,
): Prepare {
  return (finished, from) => {
    const fit = prepare(timesFromStartOfPi(finished));
    return (current, init, start) =>
      withRunsLeftOut(
        fit(current && timesFromPlace(from, current, finished), init, start),
        finished,
      );
  };
}

/** The times of the runs from the start of π, in order: a model that only takes those leaves the others out. */
export function timesFromStartOfPi(finished: readonly TimedRun[]): (readonly number[])[] {
  return finished.flatMap((run) => (run.start === 0 ? [run.times] : []));
}

/** No steps: those of a run left out. */
const LEFT_OUT: RunSteps = { baseline: [], breakProbability: [], residual: [] };

/**
 * The steps over the runs from the start of π among `finished`, and any run in progress after them, with the runs left
 * out back in their places, each with no steps of its own.
 */
export function withRunsLeftOut(steps: Steps, finished: readonly TimedRun[]): Steps {
  const fitted = steps.runs.values();
  const runs = finished.map(
    (run) => (run.start === 0 ? fitted.next().value : LEFT_OUT) ?? LEFT_OUT,
  );
  return { ...steps, runs: [...runs, ...fitted] };
}

/**
 * How the groups are played. The run being typed is one of the runs like any other, so every answer fits the runs
 * again with it, each fit starting from the last one's mixture, if any, so that it takes only a few rounds. The trust horizon is
 * the finished runs' alone, frozen for the run, so that the groups shown don't flicker between the player's own and
 * growing ones as they type.
 */
function gameplayOf(fit: Fit, ends: Ends, groupSize: number, from: number): Gameplay {
  const horizon = fit().horizon;
  let mixture: Mixture | undefined;
  const withCurrent = (current: readonly number[], start: number): Steps => {
    const steps = fit(current, mixture, start);
    mixture = steps.mixture;
    return steps;
  };
  return {
    groupAt: (current, start) => groupAt(withCurrent(current, start), start, horizon, groupSize),
    groupEnds: (current, start, trusted) =>
      ends(withCurrent(current, start), from + current.length - 1, trusted),
  };
}

/**
 * How the group starting at index `start` (index 0 is the first decimal) is played: within the trust horizon, as the
 * player's own group there, as many slots as it has digits left; past it, groups of `groupSize`, the player's setting,
 * that grow until the player breaks.
 */
export function groupAt(
  steps: Steps,
  start: number,
  horizon: number,
  groupSize: number,
): GroupPlan {
  const group = steps.groups.find((g) => start >= g.start && start < g.start + g.size);
  return group !== undefined && !group.open && group.start + group.size <= horizon
    ? { size: group.start + group.size - start, trusted: true }
    : { size: groupSize, trusted: false };
}

/**
 * Whether the group being typed is finished before the next digit, at index `next`. The steps include the run being
 * typed, like any other run, its next digit timed as if typed now. Within the trust horizon, the group ends where the
 * player usually breaks; past it, where this run breaks.
 */
export function groupEnds(steps: Steps, next: number, trusted: boolean): boolean {
  const { settings } = steps;
  return trusted
    ? (steps.usual[next] ?? 0) > settings.usualThreshold
    : (steps.runs.at(-1)?.breakProbability[next] ?? 0) > settings.breakThreshold;
}

/** What the steps make of the finished runs, for the player to see. */
function statsOf(steps: Steps): Stats {
  const { settings } = steps;
  return {
    runs: steps.runs.map((run) => ({
      breaks: breaksOf(run.breakProbability, settings.breakThreshold),
      baseline: run.baseline,
    })),
    usual: breaksOf(steps.usual, settings.usualThreshold),
    groups: steps.groups,
    discoverGroups: steps.discoverGroups ?? steps.groups,
    speedCurve: steps.speedCurve,
    averageTime: steps.averageTime,
    confidence: steps.confidenceTrend,
  };
}
