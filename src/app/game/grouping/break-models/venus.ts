import type { BreakModelKind, Hyperparameter, Settings } from './break-model';
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

/** What three of Mercury's hyperparameters mean in Venus, where it's different. */
const HELP: Readonly<Partial<Record<keyof BreakSettings, Hyperparameter['help']>>> = {
  window: {
    what: 'The average interval at each place is compared with its baseline: the average expected there without a break. The baseline is the median of the averages around it, over this many places. A break is an average clearly longer than its baseline.',
    why: 'A median, because breaks are a minority of the places: unlike an average, it isn’t pulled up by them. Along the places, rather than at each place, so that a place where you break every time still stands out. Rolling, because you slow down as you get into what you know less well.',
    moving:
      'Smaller follows changes of speed sooner, but where breaks fill nearly half the window, the median rises with them and they stop standing out. Larger is steadier but lags behind your slowdown, so the slow end can look like breaks.',
  },
  priorStrength: {
    what: 'Where few runs reach a place, the median of the averages around it could be a pause itself, so the baseline starts from the synthetic runs’ interval, and the averages take over as your runs come. It counts as this many places, times the share of the synthetic runs in the averages there.',
    why: 'Without it, a place few runs reached would have their own pauses for a baseline, so a pause there would never stand out. As your runs come, the synthetic runs weigh less in the averages, and so does this.',
    moving:
      'Higher holds the baseline at the synthetic runs’ speed longer; lower follows the averages sooner. 0 is no prior at all.',
  },
  usualThreshold: {
    what: 'How likely the average interval at a place must be a break for it to be one of your usual break spots, which cut your groups. While you play, the run being typed counts in the average, so a group ends when the average there gets over it.',
    why: 'Venus has one verdict per place, from the averages, and “usually” needs a line: ½ is as likely a break as not. The confidence, and so the trust horizon, measure how sure the game is of that verdict, given how much weight of runs reached there.',
    moving:
      'Higher asks for clearer breaks in the average, so longer groups, and a longer pause to end a group while you play; lower finds more breaks, so shorter groups. Near the line, the confidence is low and the horizon comes sooner.',
  },
};

/** Venus, as developer mode picks and tunes it. */
export const VENUS: BreakModelKind = {
  id: 'venus',
  label: 'Venus',
  description:
    'Mercury on the runs averaged place by place, so that one long pause can always end a group.',
  // Mercury's, until Venus is tuned.
  defaults: MERCURY_DEFAULTS,
  // Mercury's hyperparameters, in its tabs, with their help in Venus where they mean something else.
  tabs: MERCURY.tabs.map((tab) => ({
    ...tab,
    hyperparameters: tab.hyperparameters.map((hyperparameter) => ({
      ...hyperparameter,
      help: HELP[hyperparameter.key as keyof BreakSettings] ?? hyperparameter.help,
    })),
  })),
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
