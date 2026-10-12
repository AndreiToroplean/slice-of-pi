import {
  betaCdf,
  breakModel,
  BreakModel,
  BreakSettings,
  centeredMedian,
  DEFAULT_BREAK_SETTINGS,
  finishedRuns,
  fitMixture,
  isotonicDecreasing,
  priorMixture,
  trailingMedian,
} from './break-model';

describe('break model', () => {
  const settings = DEFAULT_BREAK_SETTINGS;
  /** Only the runs given, without synthetic ones. */
  const alone = { ...settings, syntheticRuns: 0 };

  /** A run's times from its intervals (the first digit takes none). */
  function timesOf(intervals: readonly number[]): number[] {
    let time = 0;
    return [0, ...intervals.map((interval) => (time += interval))];
  }

  /**
   * The times of `digits` digits typed about 200 ms apart (an uneven 180, 200, 230), with a 700 ms pause before each
   * index in `breaks`.
   */
  function run(digits: number, breaks: readonly number[]): number[] {
    return timesOf(
      Array.from({ length: digits - 1 }, (_, p) =>
        breaks.includes(p + 1) ? 700 : [180, 200, 230][p % 3],
      ).map((interval) => interval ?? 0),
    );
  }

  /** Every third index, up to `digits`: groups of 3. */
  function by3(digits: number): number[] {
    return Array.from({ length: Math.floor((digits - 1) / 3) }, (_, k) => 3 * (k + 1));
  }

  function model(
    finished: readonly (readonly number[])[],
    current?: readonly number[],
    tuned: BreakSettings = alone,
  ): BreakModel {
    return breakModel(finishedRuns(finished, tuned.window), current, tuned);
  }

  function spots(usual: readonly (number | undefined)[]): number[] {
    return usual.flatMap((p, i) => ((p ?? 0) > 0.5 ? [i] : []));
  }

  describe('medians', () => {
    it('takes a trailing median of the values so far only', () => {
      expect(Array.from(trailingMedian(Float64Array.from([1, 5, 2, 8, 3]), 3))).toEqual([
        1, 3, 2, 5, 3,
      ]);
    });

    it('takes a centered median, mirroring the values past both ends', () => {
      expect(Array.from(centeredMedian(Float64Array.from([1, 9, 2, 3, 7]), 3))).toEqual([
        1, 2, 3, 3, 7,
      ]);
    });

    it('reaches one value further back for an even size, taking the higher middle value', () => {
      expect(Array.from(centeredMedian(Float64Array.from([1, 9, 2, 3]), 2))).toEqual([1, 9, 9, 3]);
    });
  });

  describe('the Beta distribution', () => {
    it('matches the closed forms', () => {
      expect(betaCdf(0.5, 1, 3.7)).toBeCloseTo(1 - 0.5 ** 3.7, 10);
      expect(betaCdf(0.5, 2.5, 1)).toBeCloseTo(0.5 ** 2.5, 10);
      expect(betaCdf(0.5, 7.3, 7.3)).toBeCloseTo(0.5, 10);
      expect(betaCdf(0.3, 2, 2)).toBeCloseTo(3 * 0.3 ** 2 - 2 * 0.3 ** 3, 10);
    });

    it('is 0 and 1 at the ends', () => {
      expect(betaCdf(0, 2, 3)).toBe(0);
      expect(betaCdf(1, 2, 3)).toBe(1);
    });
  });

  describe('isotonic regression', () => {
    it('keeps values that never go up', () => {
      expect(isotonicDecreasing([3, 2, 2, 1])).toEqual([3, 2, 2, 1]);
    });

    it('pools the values that go up with those before them', () => {
      expect(isotonicDecreasing([1, 3, 2, 0, 1])).toEqual([2, 2, 2, 0.5, 0.5]);
    });
  });

  describe('the mixture', () => {
    it('separates normal intervals from breaks, component 0 being the normal one', () => {
      const residuals = Float64Array.from([-0.1, 0, 0.1, -0.05, 0.05, 1.2, 1.3, 0, 0.02, -0.02]);
      const { mixture, posterior } = fitMixture(residuals, new Float64Array(10).fill(1));

      expect(mixture.mean[0]).toBeCloseTo(0, 1);
      expect(mixture.mean[1]).toBeCloseTo(1.25, 2);
      expect(mixture.weight[1]).toBeCloseTo(0.2, 2);
      expect(Array.from(posterior, (p) => Math.round(p))).toEqual([0, 0, 0, 0, 0, 1, 1, 0, 0, 0]);
    });

    it('counts each residual with its weight', () => {
      const residuals = Float64Array.from([-0.1, 0, 0.1, -0.05, 0.05, 1.2, 1.3, 0, 0.02, -0.02]);
      const weights = Float64Array.from([1, 1, 1, 1, 1, 0.5, 0.5, 1, 1, 1]);

      expect(fitMixture(residuals, weights).mixture.weight[1]).toBeCloseTo(1 / 9, 2);
    });

    it('converges to the same mixture from the last one', () => {
      const residuals = Float64Array.from([-0.1, 0, 0.1, -0.05, 0.05, 1.2, 1.3, 0, 0.02, -0.02]);
      const weights = new Float64Array(10).fill(1);
      const cold = fitMixture(residuals, weights).mixture;
      const warm = fitMixture(residuals, weights, cold).mixture;

      expect(warm.mean[1]).toBeCloseTo(cold.mean[1], 6);
      expect(warm.sd[0]).toBeCloseTo(cold.sd[0], 6);
    });
  });

  describe('the model', () => {
    it('finds the pauses of a single run', () => {
      const found = model([run(40, by3(40))]);

      expect(spots(found.runs[0]?.breakProbability ?? [])).toEqual(by3(40));
      expect(spots(found.usual)).toEqual(by3(40));
    });

    it('has no verdict at the first digit', () => {
      const found = model([run(40, by3(40))]);

      expect(found.usual[0]).toBeUndefined();
      expect(found.runs[0]?.breakProbability[0]).toBeUndefined();
    });

    it('never takes an interval faster than usual for a break', () => {
      // Breaks of very different lengths make the break component wide, reaching far below the normal intervals.
      const intervals = Array.from({ length: 39 }, (_, p) =>
        (p + 1) % 3 === 0 ? 400 * 2 ** (p % 4) : ([180, 200, 230][p % 3] ?? 0),
      );
      intervals[10] = 5;
      const found = model([timesOf(intervals)]);

      expect(found.mixture.sd[1]).toBeGreaterThan(found.mixture.sd[0]);
      expect(found.runs[0]?.breakProbability[11]).toBe(0);
    });

    it('judges a break against the local speed, not a fixed time', () => {
      // Twice as slow in the second half, pausing as much relative to it.
      const intervals = Array.from({ length: 59 }, (_, p) => {
        const slow = p >= 30 ? 2 : 1;
        return (p + 1) % 3 === 0 ? 700 * slow : ([180, 200, 230][p % 3] ?? 0) * slow;
      });
      const found = model([timesOf(intervals)]);

      expect(spots(found.usual)).toEqual(by3(60));
    });

    it('fits the prior mixture alone without intervals', () => {
      expect(model([], [], settings).mixture.mean[1]).toBeCloseTo(
        priorMixture(settings).mean[1],
        6,
      );
    });

    it('moves the mixture from the prior to the runs’ own as they come and the synthetic runs fade', () => {
      // Breaks 4 times the baseline, where the prior expects 2.5 times.
      const breaky = (k: number): number[] =>
        timesOf(
          Array.from({ length: 59 }, (_, p) =>
            (p + 1) % 3 === 0 ? 800 + 10 * k : ([180, 200, 230][(p + k) % 3] ?? 0),
          ),
        );
      const breakSize = (runs: number, tuned: BreakSettings): number => {
        const { mean } = model(
          Array.from({ length: runs }, (_, k) => breaky(k)),
          undefined,
          tuned,
        ).mixture;
        return Math.exp(mean[1] - mean[0]);
      };
      const own = breakSize(8, alone);
      const sizes = [1, 2, 3, 4, 6, 8].map((runs) => breakSize(runs, settings));

      sizes.reduce((previous, size) => {
        expect(size).toBeGreaterThan(previous);
        return size;
      }, settings.priorBreakSize);
      expect(sizes.at(-1) ?? 0).toBeLessThan(own);
      expect(sizes.at(-1) ?? 0).toBeGreaterThan(
        settings.priorBreakSize + 0.85 * (own - settings.priorBreakSize),
      );
    });

    it('counts the synthetic runs as the oldest runs, with their own decay between them', () => {
      const found = model([run(30, []), run(30, [])], run(30, []), settings);

      // The synthetic runs go on from the oldest run, each one this much as the one after it.
      const synthetic = 0.729 * (1 + 0.5 + 0.25 + 0.125 + 0.0625);
      expect(found.coverage[1]).toBeCloseTo(1 + 0.9 + 0.81 + synthetic, 10);
      expect(found.coverage[29]).toBeCloseTo(1 + 0.9 + 0.81 + synthetic, 10);
    });

    it('holds back the groups of a single run until the synthetic runs fade', () => {
      expect(spots(model([run(40, by3(40))], undefined, settings).usual)).toEqual([]);
      const runs = Array.from({ length: 4 }, () => run(40, by3(40)));
      expect(spots(model(runs, undefined, settings).usual)).toEqual(by3(40));
    });

    it('tells breaks from the first digits on, with the prior mixture', () => {
      const found = model([], run(10, [3, 6]), settings);

      expect(spots(found.runs[0]?.breakProbability ?? [])).toEqual([3, 6]);
    });

    it("judges a first run's first intervals against the prior baseline", () => {
      // A break right away: 3 s, where the prior expects 300 ms.
      const found = model([], timesOf([3000, 200, 230]), settings);

      expect(found.runs[0]?.breakProbability[1] ?? 0).toBeGreaterThan(0.5);
      expect(found.runs[0]?.baseline[1] ?? 0).toBeGreaterThan(300);
    });

    it("judges the first intervals of a run against the earlier runs' offset", () => {
      // Earlier runs at about 200 ms, and this one pauses for 1.5 s right away.
      const found = model(
        Array.from({ length: 3 }, () => run(30, by3(30))),
        timesOf([1500, 200]),
      );

      expect(found.runs.at(-1)?.breakProbability[1] ?? 0).toBeGreaterThan(0.5);
    });

    it('judges the first interval of a run against itself without a prior', () => {
      const found = model(
        Array.from({ length: 3 }, () => run(30, by3(30))),
        timesOf([1500, 200]),
        { ...alone, priorStrength: 0 },
      );

      expect(found.runs.at(-1)?.breakProbability[1] ?? 1).toBeLessThan(0.5);
    });

    it('has no groups without digits', () => {
      expect(model([]).groups).toEqual([]);
      expect(model([], []).groups).toEqual([]);
    });

    it('weighs the runs by recency, the newest weighing 1', () => {
      const found = model([run(30, []), run(30, [])], run(30, []));

      expect(found.coverage[1]).toBeCloseTo(1 + 0.9 + 0.81, 10);
    });

    it('follows the recent runs where the player regrouped', () => {
      const old = Array.from({ length: 6 }, () => run(30, [4, 8, 12, 16, 20, 24, 28]));
      const recent = Array.from({ length: 6 }, () => run(30, by3(30)));

      expect(spots(model([...old, ...recent]).usual)).toEqual(by3(30));
      expect(spots(model([...recent, ...old]).usual)).toEqual([4, 8, 12, 16, 20, 24, 28]);
    });

    it('counts every run the same at a recency decay of 1', () => {
      const found = model([run(30, []), run(30, [])], run(30, []), {
        ...alone,
        recencyDecay: 1,
      });

      expect(found.coverage[1]).toBe(3);
    });

    it("trusts the verdicts that enough runs agree on, up to where they don't reach", () => {
      const runs = [...Array.from({ length: 4 }, () => run(60, by3(60))), run(30, by3(30))];
      const found = model(runs.slice(0, -1), runs.at(-1));

      expect(found.horizon).toBe(59);
      expect(found.groups.filter((group) => group.trusted)).toHaveLength(19);
      expect(found.groups.at(-1)).toEqual({ start: 57, size: 3, open: true, trusted: false });
    });

    it('trusts nothing a single run says', () => {
      expect(model([], run(60, by3(60))).horizon).toBe(0);
    });

    it('stops trusting where fewer runs reach', () => {
      const runs = [...Array.from({ length: 4 }, () => run(30, by3(30))), run(60, by3(60))];
      const found = model(runs);

      expect(found.horizon).toBe(29);
      expect(found.confidenceTrend[30] ?? 1).toBeLessThan(settings.level);
      expect(found.groups.filter((group) => group.trusted).at(-1)).toEqual({
        start: 24,
        size: 3,
        open: false,
        trusted: true,
      });
    });

    it('asks for more agreement at a higher level', () => {
      const runs = Array.from({ length: 3 }, () => run(30, by3(30)));

      expect(model(runs).horizon).toBe(29);
      expect(model(runs, undefined, { ...alone, level: 0.99 }).horizon).toBe(0);
    });

    it('cuts the groups at the usual break spots', () => {
      const found = model(Array.from({ length: 4 }, () => run(30, by3(30))));

      expect(found.groups.map((group) => group.size)).toEqual([...Array<number>(9).fill(3), 3]);
      expect(found.groups.at(-1)?.open).toBe(true);
    });

    it("bases the run in progress on the earlier runs' speed and its own offset from it", () => {
      // Earlier runs at about 200 ms, this one twice as slow, so its baseline doubles too.
      const earlier = Array.from({ length: 4 }, () => run(30, by3(30)));
      const slow = timesOf(
        run(20, [])
          .slice(1)
          .map((time, p, times) => 2 * (time - (times[p - 1] ?? 0))),
      );
      const found = model(earlier, slow);

      expect(found.speedCurve[10]).toBeCloseTo(200, -1);
      // At 20 intervals in, the prior (the earlier runs' offset, none) still weighs 5 of 25.
      expect(found.runs.at(-1)?.baseline[19]).toBeCloseTo(200 * 2 ** (20 / 25), -1);
    });

    it("bases the run in progress on its own speed past the earlier runs' end", () => {
      const found = model([run(10, [3])], run(40, by3(40)));

      expect(found.runs.at(-1)?.baseline[30]).toBeCloseTo(200, -1);
      expect(spots(found.runs.at(-1)?.breakProbability ?? [])).toEqual(by3(40));
    });

    it('fits the same from the last mixture', () => {
      const finished = finishedRuns(
        Array.from({ length: 4 }, () => run(60, by3(60))),
        settings.window,
      );
      const current = run(30, by3(30));
      const cold = breakModel(finished, current, settings);
      const warm = breakModel(finished, current, settings, cold.mixture);

      expect(warm.horizon).toBe(cold.horizon);
      expect(warm.mixture.mean[1]).toBeCloseTo(cold.mixture.mean[1], 6);
    });

    it('works out the finished runs again for another window', () => {
      const runs = Array.from({ length: 4 }, () => run(30, by3(30)));
      const finished = finishedRuns(runs, 21);

      expect(breakModel(finished, undefined, { ...settings, window: 5 })).toEqual(
        model(runs, undefined, { ...settings, window: 5 }),
      );
    });
  });
});
