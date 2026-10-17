import { venus } from './venus';
import { BreakModel, BreakSettings, DEFAULT_BREAK_SETTINGS, finishedRuns } from './break-model';

describe('Venus', () => {
  const settings = DEFAULT_BREAK_SETTINGS;

  /** A run's times from its intervals (the first digit takes none). */
  function timesOf(intervals: readonly number[]): number[] {
    let time = 0;
    return [0, ...intervals.map((interval) => (time += interval))];
  }

  /**
   * The times of `digits` digits typed about 200 ms apart (an uneven 180, 200, 230, shifted by `run` so that runs
   * differ), with a 700 ms pause before each index in `breaks`.
   */
  function run(digits: number, breaks: readonly number[], shift = 0): number[] {
    return timesOf(
      Array.from({ length: digits - 1 }, (_, p) =>
        breaks.includes(p + 1) ? 700 + 10 * shift : ([180, 200, 230][(p + shift) % 3] ?? 0),
      ),
    );
  }

  /** Every third index, up to `digits`: groups of 3. */
  function by3(digits: number): number[] {
    return Array.from({ length: Math.floor((digits - 1) / 3) }, (_, k) => 3 * (k + 1));
  }

  /** `count` runs of `digits` digits grouped by 3. */
  function runsBy3(count: number, digits = 30): number[][] {
    return Array.from({ length: count }, (_, k) => run(digits, by3(digits), k));
  }

  function model(
    finished: readonly (readonly number[])[],
    current?: readonly number[],
    tuned: BreakSettings = settings,
  ): BreakModel {
    return venus(finishedRuns(finished, tuned.window), current, tuned);
  }

  function spots(usual: readonly (number | undefined)[]): number[] {
    return usual.flatMap((p, i) => ((p ?? 0) > 0.5 ? [i] : []));
  }

  it('averages the intervals place by place, the newest run weighing the most', () => {
    const found = model([timesOf([100, 100]), timesOf([400, 200])], undefined, {
      ...settings,
      syntheticRuns: 0,
    });

    expect(found.averageTime[1]).toBeCloseTo((0.9 * 100 + 400) / 1.9, 10);
    expect(found.averageTime[2]).toBeCloseTo((0.9 * 100 + 200) / 1.9, 10);
    expect(found.coverage[1]).toBeCloseTo(1.9, 10);
  });

  it('counts the synthetic runs in the averages, at the prior mixture’s mean interval', () => {
    const found = model([timesOf([100, 100])], undefined, { ...settings, syntheticRuns: 1 });
    const synthetic =
      settings.priorBaseline *
      (1 - settings.priorBreakShare + settings.priorBreakShare * settings.priorBreakSize);

    expect(found.coverage[1]).toBeCloseTo(1.9, 10);
    expect(found.averageTime[1]).toBeCloseTo(100, 10);
    expect(found.speedCurve[1]).toBeGreaterThan(100);
    expect(found.speedCurve[1]).toBeLessThan(synthetic);
  });

  it('finds the player’s groups where their runs usually break', () => {
    const found = model(runsBy3(6));

    expect(spots(found.usual)).toEqual(by3(30));
    expect(found.groups.slice(0, 3).map((group) => group.size)).toEqual([3, 3, 3]);
    expect(found.series?.breakProbability).toBe(found.usual);
  });

  it('keeps out a break only one run in ten makes', () => {
    const runs = runsBy3(10);
    runs[3] = run(30, [...by3(30), 5], 3);

    expect(spots(model(runs).usual)).toEqual(by3(30));
  });

  it('ends a group where a long enough pause in the run being typed lifts the average, however many runs carry on', () => {
    const earlier = runsBy3(10);
    // Typing the first group, then pausing before its last digit, where no run ever broke.
    const pausing = (pause: number): number => {
      const times = run(2, []);
      return model(earlier, [...times, (times.at(-1) ?? 0) + pause]).usual[2] ?? 0;
    };

    expect(pausing(300)).toBeLessThan(0.5);
    expect(pausing(10_000)).toBeGreaterThan(0.5);
  });

  it('judges each run against the average’s baseline, by the same mixture', () => {
    const found = model(runsBy3(6));

    expect(found.runs).toHaveLength(6);
    expect(found.runs[5]?.baseline).toEqual(found.speedCurve.slice(0, 30));
    expect(spots(found.runs[5]?.breakProbability ?? [])).toEqual(by3(30));
  });

  it('trusts the groups only as far as enough runs reach', () => {
    const found = model([...runsBy3(6, 30), run(60, by3(60), 6)]);

    expect(found.horizon).toBeGreaterThan(20);
    expect(found.horizon).toBeLessThan(30);
    expect(found.groups.at(-2)?.trusted).toBe(false);
  });

  it('tells a new player’s breaks from their very first digits, by the synthetic runs', () => {
    const found = model(
      [],
      run(10, [3, 7]).map((time, i) => time + (i >= 3 ? 1500 : 0)),
    );

    expect(spots(found.usual)).toEqual([3]);
  });

  it('gives no groups without any run', () => {
    const found = model([]);

    expect(found.groups).toEqual([]);
    expect(found.horizon).toBe(0);
  });
});
