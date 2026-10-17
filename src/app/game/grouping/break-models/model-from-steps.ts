import type { GroupPlan } from '../groups';
import type { BreakModel, Gameplay, Stats } from './break-model';
import type { Mixture } from './statistics';
import { breaksOf, Steps } from './steps';

/**
 * Works out the steps over the finished runs it was given and, if given, the run in progress, which is then the newest.
 * `init` is the last mixture fitted, if any, to start the fit from.
 */
export type Fit = (current?: readonly number[], init?: Mixture) => Steps;

/**
 * The model the game sees, from a model that works out its steps (`steps.ts`): `prepare` takes the finished runs,
 * oldest first, and gives what fits them, with a run in progress or without.
 */
export function modelFromSteps(
  prepare: (finished: readonly (readonly number[])[]) => Fit,
): BreakModel {
  return {
    play: (finished) => gameplayOf(prepare(finished)),
    stats: (finished) => statsOf(prepare(finished)()),
  };
}

/**
 * How the groups are played. The run being typed is one of the runs like any other, so every answer fits the runs
 * again with it, each fit starting from the last one's mixture, if any, so that it takes only a few rounds. The trust horizon is
 * the finished runs' alone, frozen for the run, so that the groups shown don't flicker between the player's own and
 * growing ones as they type.
 */
function gameplayOf(fit: Fit): Gameplay {
  const horizon = fit().horizon;
  let mixture: Mixture | undefined;
  const withCurrent = (current: readonly number[]): Steps => {
    const steps = fit(current, mixture);
    mixture = steps.mixture;
    return steps;
  };
  return {
    groupAt: (current, start) => groupAt(withCurrent(current), start, horizon),
    groupEnds: (current, trusted) => groupEnds(withCurrent(current), current.length - 1, trusted),
  };
}

/**
 * How the group starting at index `start` (index 0 is the first decimal) is played: within the trust horizon, as the
 * player's own group there, as many slots as it has digits left; past it, groups of the starting slots (5 by default)
 * that grow until the player breaks.
 */
export function groupAt(steps: Steps, start: number, horizon: number): GroupPlan {
  const group = steps.groups.find((g) => start >= g.start && start < g.start + g.size);
  return group !== undefined && !group.open && group.start + group.size <= horizon
    ? { size: group.start + group.size - start, trusted: true }
    : { size: steps.settings.startingSlots, trusted: false };
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
    speedCurve: steps.speedCurve,
    averageTime: steps.averageTime,
    confidence: steps.confidenceTrend,
  };
}
