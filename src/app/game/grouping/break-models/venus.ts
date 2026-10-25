import type { BreakModelKind, Settings } from './break-model';
import { BreakSettings } from './hyperparameters';
import { MERCURY, MERCURY_DEFAULTS } from './mercury';
import { modelFromSteps } from './model-from-steps';
import { centeredMedian, Mixture } from './statistics';
import {
  byIndex,
  fitBreaks,
  groupsOf,
  logIntervals,
  longestOf,
  runWeights,
  Steps,
  trustOf,
} from './steps';

/**
 * Venus: Mercury (`mercury.ts`) on the runs averaged place by place, rather than on each run's breaks. It works out
 * one series, the average interval at each place, and judges that once: where the average breaks, the player usually
 * does.
 *
 * The average at a place is the recency-weighted mean of the intervals of the runs that reached it, in milliseconds,
 * synthetic runs included: a mean of the times themselves, not of their logs nor of each run's verdict, so that a pause
 * long enough always lifts it into a break, however many runs carried on there. The run being typed counts in it like
 * any other, its next digit timed as if typed now: one long pause ends the group. With Mercury, a run adds at most its
 * own weight to the share of runs breaking at a place, so a pause where a few earlier runs carried on never ends it.
 *
 * Its own step is that series and its baseline, a centered rolling median of its logs along the places, shrunk toward
 * the synthetic runs' interval as much as they weigh in the averages there. The mixture is fitted to the series'
 * residuals, each weighing as much as the runs averaged there, and its P(break) is the usual-break probability. Each
 * run's own intervals, which end the groups past the trust horizon, are judged against the series' baseline by the
 * same mixture. The confidence takes the usual-break probability as the share of the runs' weight breaking at a place.
 */
export function venus(
  finished: readonly (readonly number[])[],
  current: readonly number[] | undefined,
  settings: BreakSettings,
  init?: Mixture,
): Extract<Steps, { readonly mixture: Mixture }> {
  const all = current === undefined ? finished : [...finished, current];
  const logs = all.map(logIntervals);
  const { weights, synthetic } = runWeights(logs.length, settings);
  const longest = longestOf(logs);
  // A synthetic run's interval everywhere: the prior baseline, its breaks spread over all places.
  const syntheticInterval =
    settings.priorBaseline *
    (1 - settings.priorBreakShare + settings.priorBreakShare * settings.priorBreakSize);

  // The weight of the player's runs that reached each place, and their weighted sum of intervals there.
  const played = new Float64Array(longest);
  const timeSums = new Float64Array(longest);
  logs.forEach((log, k) => {
    const weight = weights[k] ?? 0;
    log.forEach((value, p) => {
      played[p] = (played[p] ?? 0) + weight;
      timeSums[p] = (timeSums[p] ?? 0) + weight * Math.exp(value);
    });
  });
  const series = timeSums.map((sum, p) =>
    Math.log((sum + synthetic * syntheticInterval) / ((played[p] ?? 0) + synthetic)),
  );
  // A median of few places could be a pause itself: it starts from the synthetic runs' interval, for as much as they
  // weigh in the averages there.
  const size = Math.min(settings.window, longest);
  const baseline = centeredMedian(series, size).map((median, p) => {
    const prior = (settings.priorStrength * synthetic) / (synthetic + (played[p] ?? 0));
    return (prior * Math.log(syntheticInterval) + size * median) / (prior + size);
  });

  // The series is fitted; each run, weighing nothing in the fit, is only judged by it.
  const fit = fitBreaks(
    [...logs, series],
    [...logs.map(() => baseline), baseline],
    [...logs.map(() => 0), played],
    synthetic,
    settings,
    init,
  );
  const runs = fit.runs.slice(0, -1);
  const usual = fit.runs.at(-1)?.breakProbability ?? [undefined];
  const coverage = byIndex(Array.from(played, (weight) => weight + synthetic));
  const breaks = Array.from(
    played,
    (weight, p) => weight * (usual[p + 1] ?? 0) + synthetic * settings.priorBreakShare,
  );
  const trust = trustOf(usual, breaks, coverage, settings);
  return {
    settings,
    runs,
    usual,
    coverage,
    ...trust,
    speedCurve: byIndex(Array.from(baseline, Math.exp)),
    averageTime: byIndex(Array.from(timeSums, (sum, p) => sum / (played[p] ?? 1))),
    mixture: fit.mixture,
    groups: groupsOf(
      usual,
      settings.usualThreshold,
      Math.max(0, ...all.map((times) => times.length)),
      trust.horizon,
    ),
  };
}

/** Venus, as developer mode picks and tunes it. */
export const VENUS: BreakModelKind = {
  id: 'venus',
  label: 'Venus',
  description:
    'Mercury on the runs averaged place by place, so that one long pause can always end a group.',
  // Mercury's, until Venus is tuned.
  defaults: MERCURY_DEFAULTS,
  // Mercury's hyperparameters, in its tabs.
  tabs: MERCURY.tabs,
  create: (tuned) => {
    const settings = withDefaults(tuned);
    return modelFromSteps(
      (finished) => (current, init) => venus(finished, current, settings, init),
    );
  },
  steps: (tuned, finished) => venus(finished, undefined, withDefaults(tuned)),
};

/** Venus's hyperparameters, each one not tuned at its default. */
function withDefaults(tuned: Settings): BreakSettings {
  return { ...MERCURY_DEFAULTS, ...tuned };
}
