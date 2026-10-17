import {
  betaCdf,
  BreakModel,
  BreakSettings,
  byIndex,
  centeredMedian,
  FinishedRuns,
  fitMixture,
  groupsOf,
  isotonicDecreasing,
  logIntervals,
  Mixture,
  mixtureDensity,
  priorMixture,
  RunBreaks,
} from './break-model';
import { BreakModelChoice } from './break-models';

/**
 * Venus: Mercury (`break-model.ts`) on the runs' timings averaged place by place, rather than on each run's breaks:
 *
 * 1. The average interval at each place is the recency-weighted mean of the intervals of the runs that reached it, in
 *    milliseconds, synthetic runs included. A mean of the times themselves, not of their logs nor of each run's
 *    P(break): however many runs carry on at a place, one pause long enough always lifts the average into a break.
 * 2. Mercury's steps then run on that one series of averages: its baseline is a centered rolling median of their logs,
 *    shrunk toward the synthetic runs' average as much as they weigh there, its residuals their logs minus the
 *    baseline, and a mixture of normal intervals and breaks fitted to them, each weighted by the weight of the runs
 *    averaged there, gives P(break) at each place. That's the usual-break probability: the usual break spots are where
 *    it's over the usual threshold.
 * 3. The confidence at a place takes the usual-break probability as the break rate of the player's runs that reached
 *    it, by their weight, and the synthetic runs as breaking there as often as the prior mixture says, as in Mercury:
 *    it drops as fewer runs reach a place and where the average is borderline. Its trend gives the trust horizon as in
 *    Mercury.
 *
 * Each run's own intervals are judged against the average's baseline, by the same mixture: past the trust horizon, the
 * run being typed breaks where its own interval is a break.
 *
 * Synthetic runs count as in Mercury, each one's interval at every place the prior mixture's mean: the prior
 * baseline, its breaks spread over all places. A run in progress, the newest, counts in the average like any other, its
 * next digit timed as if typed now, so a pause there lifts the average there until it's a break.
 */
export function venus(
  finished: FinishedRuns,
  current: readonly number[] | undefined,
  settings: BreakSettings,
  init?: Mixture,
): BreakModel {
  const all = current === undefined ? finished.times : [...finished.times, current];
  const logs = all.map(logIntervals);
  const count = logs.length;
  const weights = logs.map((_, k) => settings.recencyDecay ** (count - 1 - k));
  const longest = Math.max(0, ...logs.map((log) => log.length));
  let synthetic = 0;
  for (let j = 0; j < settings.syntheticRuns; j++) {
    synthetic += settings.recencyDecay ** count * settings.syntheticDecay ** j;
  }
  const syntheticInterval =
    settings.priorBaseline *
    (1 - settings.priorBreakShare + settings.priorBreakShare * settings.priorBreakSize);

  // The average interval at each place, and the weight of the runs averaged there.
  const average = new Float64Array(longest);
  const played = new Float64Array(longest);
  const coverage: (number | undefined)[] = [undefined];
  const averageTime: (number | undefined)[] = [undefined];
  for (let p = 0; p < longest; p++) {
    let reached = 0;
    let sum = 0;
    logs.forEach((log, k) => {
      const value = log[p];
      if (value !== undefined) {
        const weight = weights[k] ?? 0;
        reached += weight;
        sum += weight * Math.exp(value);
      }
    });
    average[p] = (sum + synthetic * syntheticInterval) / (reached + synthetic);
    played[p] = reached;
    coverage.push(reached + synthetic);
    averageTime.push(sum / reached);
  }

  // The steps of the break model, on the averages.
  const logAverage = average.map(Math.log);
  // A median of few averages could be the pause itself: it's shrunk toward the synthetic runs' average, for as much as
  // they weigh in the averages.
  const size = Math.min(settings.window, longest);
  const median = centeredMedian(logAverage, size);
  const baseline = median.map((value, p) => {
    const prior = (settings.priorStrength * synthetic) / (synthetic + (played[p] ?? 0));
    return (prior * Math.log(syntheticInterval) + size * value) / (prior + size);
  });
  const residuals = logAverage.map((value, p) => value - (baseline[p] ?? value));
  const prior = priorMixture(settings);
  const fit = fitMixture(residuals, played, init ?? (longest === 0 ? prior : undefined), {
    mixture: prior,
    strength: synthetic * longest,
  });
  // A break is never faster than a normal interval.
  const breakProbability = (residual: number, posterior: number): number =>
    residual < fit.mixture.mean[0] ? 0 : posterior;
  const usual = byIndex(
    Array.from(fit.posterior, (posterior, p) => breakProbability(residuals[p] ?? 0, posterior)),
  );
  const averaged: RunBreaks = {
    baseline: byIndex(Array.from(baseline, Math.exp)),
    breakProbability: usual,
    residual: byIndex(Array.from(residuals)),
  };

  // Each run against the average's baseline, by the same mixture.
  const runs = logs.map((log): RunBreaks => {
    const residual = log.map((value, p) => value - (baseline[p] ?? value));
    return {
      baseline: averaged.baseline.slice(0, log.length + 1),
      breakProbability: byIndex(
        Array.from(residual, (r) => {
          const [normal, pause] = mixtureDensity(fit.mixture, r);
          return breakProbability(r, pause / (normal + pause || 1));
        }),
      ),
      residual: byIndex(Array.from(residual)),
    };
  });

  // The confidence in the verdict at each index, its trend, and the horizon.
  const threshold = settings.usualThreshold;
  const raw = Array.from({ length: longest }, (_, p) => {
    const reached = coverage[p + 1] ?? 0;
    const breaks = (played[p] ?? 0) * (usual[p + 1] ?? 0) + synthetic * settings.priorBreakShare;
    const below = betaCdf(threshold, 1 + breaks, 1 + reached - breaks);
    return (usual[p + 1] ?? 0) > threshold ? 1 - below : below;
  });
  const trend = isotonicDecreasing(raw);
  const horizon = trend.filter((value) => value >= settings.level).length;

  return {
    runs,
    usual,
    coverage,
    confidence: [undefined, ...raw],
    confidenceTrend: [undefined, ...trend],
    horizon,
    speedCurve: averaged.baseline,
    averageTime,
    mixture: fit.mixture,
    groups: groupsOf(usual, threshold, Math.max(0, ...all.map((times) => times.length)), horizon),
    series: averaged,
  };
}

/** Venus, as the game plugs it in. */
export const VENUS: BreakModelChoice = {
  name: 'venus',
  label: 'Venus',
  description:
    'Mercury on the runs averaged place by place, so that one long pause can always end a group.',
  help: {
    window: {
      what: 'The average interval at each place is compared with its baseline: the average expected there without a break. The baseline is the median of the averages around it, over this many places. A break is an average clearly longer than its baseline.',
      why: 'A median, because breaks are a minority of the places: unlike an average, it isn’t pulled up by them. Along the places, rather than at each place, so that a place where you break every time still stands out. Rolling, because you slow down as you get into what you know less well.',
      moving:
        'Smaller follows changes of speed sooner, but where breaks fill nearly half the window, the median rises with them and they stop standing out. Larger is steadier but lags behind your slowdown, so the slow end can look like breaks.',
    },
    priorStrength: {
      what: 'Where few places have been typed yet, the median of their averages could be a pause itself, so the baseline starts from the synthetic runs’ average, and the averages take over as they come. It counts as this many places, times the share of the synthetic runs in the averages there: at 5, on a first run where they weigh two thirds, it counts as about 3 places.',
      why: 'Without it, the first places’ baseline would be their own averages, so a pause there would never stand out. As your runs come, the synthetic runs weigh less in the averages, and so does this.',
      moving:
        'Higher holds the baseline at the synthetic runs’ speed longer; lower follows the averages sooner. 0 is no prior at all.',
    },
    usualThreshold: {
      what: 'How likely the average interval at a place must be a break for it to be one of your usual break spots, which cut your groups. While you play, the run being typed counts in the average, so a group ends when the average there gets over it.',
      why: 'Venus has only one verdict per place, from the averages, and “usually” needs a line: ½ is as likely a break as not. The confidence, and so the trust horizon, measure how sure the game is of that verdict, given how much weight of runs reached there.',
      moving:
        'Higher asks for clearer breaks in the average, so longer groups, and a longer pause to end a group while you play; lower finds more breaks, so shorter groups. Near the line, the confidence is low and the horizon comes sooner.',
    },
  },
  run: venus,
};
