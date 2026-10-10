import {
  aggregate,
  analyzeRun,
  DEFAULT_TIMING_SETTINGS,
  Group,
  isConfident,
  recencyWeight,
  RunPlace,
  TimingSettings,
} from './timing-model';

describe('timing model', () => {
  const settings = DEFAULT_TIMING_SETTINGS;

  /** A run's times from the time each digit took after the one before (the first digit takes none). */
  function timesOf(intervals: readonly number[]): number[] {
    let time = 0;
    return [0, ...intervals.map((interval) => (time += interval))];
  }

  /** Digits typed 200 ms apart, with a 700 ms pause before every third digit: groups of 3. */
  function grouped(digits: number): number[] {
    return timesOf(Array.from({ length: digits - 1 }, (_, i) => ((i + 1) % 3 === 0 ? 700 : 200)));
  }

  /** Digits typed at a steady 200 ms, give or take 10. */
  function steady(digits: number): number[] {
    return timesOf(Array.from({ length: digits - 1 }, (_, i) => (i % 2 === 0 ? 190 : 210)));
  }

  function breaks(places: readonly ({ isBreak: boolean } | undefined)[]): number[] {
    return places.flatMap((place, i) => (place?.isBreak === true ? [i] : []));
  }

  function sizes(groups: readonly Group[]): number[] {
    return groups.map((group) => group.size);
  }

  function at<T>(values: readonly (T | undefined)[], i: number): T {
    const value = values[i];
    if (value === undefined) {
      throw new Error(`Nothing at ${String(i)}`);
    }
    return value;
  }

  describe('one run', () => {
    it('has no verdict before the first digit, and times each digit from the one before', () => {
      const places = analyzeRun([0, 200, 450, 650, 850], settings);

      expect(places[0]).toBeUndefined();
      expect(places.map((place) => place?.time)).toEqual([undefined, 200, 250, 200, 200]);
    });

    it('finds a break at each pause', () => {
      expect(breaks(analyzeRun(grouped(30), settings))).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 27]);
    });

    it('fully trusts a rhythm of clear pauses', () => {
      const places = analyzeRun(grouped(30), settings);

      expect(at(places, 15).trust).toBe(1);
    });

    it('barely trusts a steady stream, and finds no breaks in it', () => {
      const places = analyzeRun(steady(30), settings);

      expect(breaks(places)).toEqual([]);
      expect(at(places, 15).trust).toBeLessThan(0.1);
    });

    it('measures the pace from the neighbors only, so a pause never raises its own bar', () => {
      const intervals = Array.from({ length: 20 }, (_, i) => (i === 9 ? 275 : 200));
      const place = at(analyzeRun(timesOf(intervals), settings), 10);

      expect(place.pace).toBeCloseTo(200);
      expect(place.threshold).toBeCloseTo(270);
      expect(place.isBreak).toBe(true);
    });

    it('needs a pause to be longer than the minimum, even where the rhythm is steady', () => {
      const intervals = Array.from({ length: 20 }, (_, i) => (i === 9 ? 260 : i % 2 ? 190 : 210));
      const times = timesOf(intervals);

      expect(at(analyzeRun(times, settings), 10).isBreak).toBe(false);
      expect(at(analyzeRun(times, { ...settings, minimumPause: 1 }), 10).isBreak).toBe(true);
    });

    it('finds shorter pauses the smaller the pause margin', () => {
      // Pauses of 500 and 900 ms in turn.
      const intervals = Array.from({ length: 29 }, (_, i) =>
        (i + 1) % 3 === 0 ? (i % 2 ? 500 : 900) : 200,
      );
      const times = timesOf(intervals);

      expect(breaks(analyzeRun(times, settings))).toEqual([3, 9, 15, 21, 27]);
      expect(breaks(analyzeRun(times, { ...settings, pauseMargin: 0.4 }))).toEqual([
        3, 6, 9, 12, 15, 18, 21, 24, 27,
      ]);
    });

    it('judges any speed alike', () => {
      const times = grouped(30);
      const slower = analyzeRun(
        times.map((time) => time * 3),
        settings,
      );
      const places = analyzeRun(times, settings);

      expect(breaks(slower)).toEqual(breaks(places));
      expect(slower.map((place) => place?.trust)).toEqual(places.map((place) => place?.trust));
    });

    it('falls back on a fixed pause while the run is too short to judge', () => {
      const places = analyzeRun([0, 200, 1300], settings);

      expect(at(places, 2)).toEqual({
        time: 1100,
        pace: undefined,
        threshold: 900,
        isBreak: true,
        trust: 0.5,
      });
    });
  });

  describe('recency', () => {
    it('halves a run’s weight every half-life', () => {
      expect(recencyWeight(0, settings)).toBe(1);
      expect(recencyWeight(16, settings)).toBe(0.5);
      expect(recencyWeight(32, settings)).toBe(0.25);
    });
  });

  describe('runs together', () => {
    function analyze(runs: readonly number[][], custom: TimingSettings = settings) {
      return aggregate(
        runs.map((times) => analyzeRun(times, custom)),
        custom,
      );
    }

    it('has nothing to group without runs', () => {
      expect(analyze([])).toEqual({ places: [], groups: [] });
    });

    it('follows a single run, with the confidence its evidence gives', () => {
      const result = analyze([grouped(30)]);

      expect(breaks(result.places)).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 27]);
      expect(at(result.places, 15).confidence).toBeCloseTo(1 - Math.exp(-1 / 1.2));
    });

    it('cuts the digits into groups at its breaks, the last one open', () => {
      const { groups } = analyze([grouped(14)]);

      expect(sizes(groups)).toEqual([3, 3, 3, 3, 2]);
      expect(groups.at(-1)).toEqual({ start: 12, size: 2, confidence: 0, open: true });
      expect(groups.map((group) => isConfident(group, settings))).toEqual([
        true,
        true,
        true,
        true,
        false,
      ]);
    });

    it('grows surer as runs agree', () => {
      const one = analyze([grouped(30)]);
      const three = analyze([grouped(30), grouped(30), grouped(30)]);

      expect(at(three.places, 15).confidence).toBeGreaterThan(at(one.places, 15).confidence);
    });

    it('lets the newer run win when two disagree, but with little confidence', () => {
      const older = timesOf(Array.from({ length: 29 }, (_, i) => ((i + 1) % 4 === 0 ? 700 : 200)));
      const result = analyze([older, grouped(30)]);

      expect(at(result.places, 3).isBreak).toBe(true);
      expect(at(result.places, 4).isBreak).toBe(false);
      expect(at(result.places, 3).confidence).toBeLessThan(0.1);
    });

    it('keeps the groups of earlier runs when later ones are typed in a steady stream', () => {
      const runs = [
        grouped(30),
        grouped(30),
        grouped(30),
        ...Array.from({ length: 4 }, () => steady(30)),
      ];

      expect(breaks(analyze(runs).places)).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 27]);
      // Trusting every run alike, the steady runs would wash the groups out.
      expect(breaks(analyze(runs, { ...settings, fullTrustUnevenness: 0.01 }).places)).toEqual([]);
    });

    it('lets old runs fade away with a short half-life', () => {
      const older = timesOf(Array.from({ length: 29 }, (_, i) => ((i + 1) % 4 === 0 ? 700 : 200)));
      const runs = [grouped(30), grouped(30), older];

      expect(at(analyze(runs).places, 4).isBreak).toBe(false);
      expect(at(analyze(runs, { ...settings, halfLife: 0.5 }).places, 4).isBreak).toBe(true);
    });

    it('takes the places past a shorter run from the longer ones', () => {
      const result = analyze([grouped(30), grouped(9)]);

      expect(result.places).toHaveLength(30);
      expect(at(result.places, 27).isBreak).toBe(true);
    });

    it('averages the time at each place, recent runs weighing more', () => {
      const result = analyze(
        [
          [0, 100],
          [0, 300],
        ],
        { ...settings, halfLife: 1 },
      );

      expect(at(result.places, 1).time).toBeCloseTo((100 * 0.5 + 300) / 1.5);
    });

    it('averages the confidence of a group over the verdicts inside it and at its end', () => {
      const { places, groups } = analyze([grouped(14)]);
      const second = at(groups, 1);
      const verdicts = [4, 5, 6].map((i) => at(places, i).confidence);

      expect(second.start).toBe(3);
      expect(second.confidence).toBeCloseTo(verdicts.reduce((a, b) => a + b) / 3);
    });
  });

  it('has trust between 0 and 1', () => {
    const places = analyzeRun(grouped(30), settings).filter(
      (place): place is RunPlace => place !== undefined,
    );

    expect(places.every((place) => place.trust >= 0 && place.trust <= 1)).toBe(true);
  });
});
