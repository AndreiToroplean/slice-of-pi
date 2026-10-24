import type { Settings } from './break-model';
import { mars, MARS, MARS_DEFAULTS, marsOver } from './mars';
import { logistic, logit } from './statistics';
import { judge } from './terra';

describe('Mars', () => {
  /**
   * The times of a run of `length` digits typed about 200 ms apart (an uneven 180, 200, 230), with a pause of `pause` ms
   * before each index in `breaks`.
   */
  function timesOf(length: number, breaks: readonly number[], pause = 700): number[] {
    let time = 0;
    return Array.from({ length }, (_, i) => {
      if (i > 0) {
        time += breaks.includes(i) ? pause : ([180, 200, 230][i % 3] ?? 0);
      }
      return time;
    });
  }

  /** Every third index, up to `length`: groups of 3. */
  function by3(length: number): number[] {
    return Array.from({ length: Math.floor((length - 1) / 3) }, (_, k) => 3 * (k + 1));
  }

  const grouped = Array.from({ length: 4 }, () => timesOf(30, by3(30)));

  /** How long the player must wait after typing `typed` digits of a grouped run for the group to end, to 10 ms. */
  function waitToEnd(
    earlier: readonly (readonly number[])[],
    typed: number,
    settings: Settings = {},
  ): number {
    const play = MARS.create(settings).play(earlier);
    const times = timesOf(typed, by3(30));
    const last = times.at(-1) ?? 0;
    let wait = 0;
    while (!play.groupEnds([...times, last + wait], true)) {
      wait += 10;
    }
    return wait;
  }

  it('finds where the runs usually break, and groups them there', () => {
    const stats = MARS.create({}).stats(grouped);

    expect(stats.usual.map((found) => found.place)).toEqual(by3(30));
    expect(stats.groups.map((group) => group.size)).toEqual(Array<number>(10).fill(3));
  });

  it('ends a group at a long enough pause, however many runs carried on there', () => {
    // Before index 14, where no run breaks.
    expect(waitToEnd(grouped.slice(0, 1), 14)).toBeLessThan(10_000);
    expect(waitToEnd(grouped, 14)).toBeLessThan(10_000);
  });

  it('asks for a longer pause the more runs carried on there', () => {
    expect(waitToEnd(grouped, 14)).toBeGreaterThan(waitToEnd(grouped.slice(0, 1), 14));
  });

  it('ends a group where the runs usually break before the next digit would come', () => {
    // About 200 ms apart.
    expect(waitToEnd(grouped, 15)).toBeLessThan(180);
  });

  it('lets runs typed through a usual break spot undo it', () => {
    const through = Array.from({ length: 6 }, () =>
      timesOf(
        30,
        by3(30).filter((i) => i !== 15),
      ),
    );
    const places = (runs: readonly (readonly number[])[]) =>
      MARS.create({})
        .stats(runs)
        .usual.map((found) => found.place);

    expect(places(grouped)).toContain(15);
    expect(places([...grouped, ...through])).not.toContain(15);
  });

  it('counts an interval faster than its pace against a break', () => {
    // The same run, its interval before index 4 a sixth as long.
    const times = timesOf(9, []);
    const steady = mars([judge(times, MARS_DEFAULTS)], undefined, MARS_DEFAULTS);
    const fast = mars(
      [
        judge(
          times.map((time, i) => (i < 4 ? time : time - 150)),
          MARS_DEFAULTS,
        ),
      ],
      undefined,
      MARS_DEFAULTS,
    );

    expect(fast.usual[4]).toBeLessThan(steady.usual[4] ?? 0);
  });

  it('trusts the groups only once enough runs agree', () => {
    // At level 0, the default, the game trusts any groups.
    const settings = { ...MARS_DEFAULTS, level: 0.9 };
    const horizon = (runs: readonly (readonly number[])[]) =>
      mars(
        runs.map((times) => judge(times, settings)),
        undefined,
        settings,
      ).horizon;

    const many = Array.from({ length: 12 }, () => timesOf(30, by3(30)));

    expect(horizon(many.slice(0, 1))).toBe(0);
    expect(horizon(many)).toBeGreaterThan(20);
  });

  it("follows the player's groups within the trust horizon", () => {
    expect(MARS.create({}).play(grouped).groupAt([], 3)).toEqual({ size: 3, trusted: true });
  });

  it("tells a new player's breaks from their first run", () => {
    const play = MARS.create({}).play([]);

    expect(play.groupEnds(timesOf(8, [7], 2000), false)).toBe(true);
    expect(play.groupEnds(timesOf(8, []), false)).toBe(false);
  });

  it('lets a pause end a group from the start of a run, its few neighbors there pooled with the prior unevenness', () => {
    expect(waitToEnd(grouped, 2)).toBeLessThan(10_000);
  });

  it('weighs the runs by their recency alone without the trust', () => {
    // A metronome: no unevenness, so no trust, but steady all along, so evidence against a break everywhere.
    const steady = [Array.from({ length: 12 }, (_, i) => 200 * i)];
    const usual = (trustInfluence: number) =>
      MARS.steps?.({ priorUnevenness: 0, trustInfluence }, steady).usual[6];

    expect(usual(1)).toBeCloseTo(MARS_DEFAULTS.breakShare, 5);
    expect(usual(0)).toBeLessThan(MARS_DEFAULTS.breakShare - 0.1);
  });

  it('lets the run being typed count for more than the recorded runs, by the current decay', () => {
    expect(waitToEnd(grouped, 14, { currentDecay: 0.1 })).toBeLessThan(
      waitToEnd(grouped, 14, { currentDecay: 1 }),
    );
  });

  it('weighs no run by the current decay without a run being typed', () => {
    const uneven = [timesOf(30, by3(30)), timesOf(30, [5, 10, 20]), timesOf(30, [])];

    expect(MARS.steps?.({ currentDecay: 0.1 }, uneven).usual).toEqual(
      MARS.steps?.({ currentDecay: 1 }, uneven).usual,
    );
  });

  it('gives the same steps for each run being typed however many were asked about before', () => {
    const judged = [timesOf(30, by3(30)), timesOf(20, [5, 10, 15]), timesOf(30, [])].map((times) =>
      judge(times, MARS_DEFAULTS),
    );
    const over = marsOver(judged, MARS_DEFAULTS);
    for (const current of [timesOf(4, [3]), timesOf(14, by3(30), 1500), timesOf(40, by3(40))]) {
      expect(over(current)).toEqual(mars(judged, current, MARS_DEFAULTS));
    }
    expect(over()).toEqual(mars(judged, undefined, MARS_DEFAULTS));
  });

  it('adds the run being typed to the recorded runs as one more run', () => {
    // At the recency decay, the run being typed weighs what a run recorded after the others would.
    const settings = { ...MARS_DEFAULTS, currentDecay: MARS_DEFAULTS.recencyDecay };
    const recorded = [timesOf(30, by3(30)), timesOf(20, [5, 10, 15])];
    const current = timesOf(40, by3(40), 1500);
    const typed = mars(
      recorded.map((times) => judge(times, settings)),
      current,
      settings,
    );
    const all = mars(
      [...recorded, current].map((times) => judge(times, settings)),
      undefined,
      settings,
    );

    expect(typed.usual.length).toBe(all.usual.length);
    typed.usual.slice(1).forEach((usual, p) => {
      expect(usual).toBeCloseTo(all.usual[p + 1] ?? NaN, 12);
    });
    expect(typed.groups).toEqual(all.groups);
    expect(typed.speedCurve).toEqual(all.speedCurve);
  });

  describe('working out its steps', () => {
    const runs = [timesOf(30, by3(30)), timesOf(20, [5, 10, 15]), timesOf(30, [])];
    const steps = MARS.steps?.({}, runs);
    const workings = steps?.workings;
    const pool = workings?.pool;
    const { breakShift, breakShare, breakThreshold, currentDecay } = MARS_DEFAULTS;

    it("adds up each run's evidence, times its recency and its trust, to the prior", () => {
      const at = 15;
      const sum = (workings?.runs ?? []).reduce(
        (total, run) => total + run.recency * (run.trust[at] ?? 0) * (run.evidence[at] ?? 0),
        logit(breakShare),
      );

      expect(pool?.logOdds[at]).toBeCloseTo(sum, 12);
      expect(logistic(pool?.logOdds[at] ?? NaN)).toBeCloseTo(steps?.usual[at] ?? NaN, 12);
      expect(workings?.runs.map((run) => run.recency)).toEqual([
        MARS_DEFAULTS.recencyDecay ** 2,
        MARS_DEFAULTS.recencyDecay,
        1,
      ]);
    });

    it('takes the prior to the break threshold at the z a lone run breaks at', () => {
      const evidence = breakShift * (workings?.breakZ ?? NaN) - breakShift ** 2 / 2;

      expect(logistic(logit(breakShare) + evidence)).toBeCloseTo(breakThreshold, 12);
      expect(workings?.evenZ).toBe(breakShift / 2);
    });

    it('asks the next run for a longer pause where the runs carry on than where they break', () => {
      const at = 14;
      const z = pool?.nextRunZ[at] ?? NaN;
      const logOdds = pool?.logOdds[at] ?? NaN;
      const prior = logit(breakShare);

      expect(
        prior + currentDecay * (logOdds - prior) + breakShift * z - breakShift ** 2 / 2,
      ).toBeCloseTo(logit(breakThreshold), 12);
      expect(pool?.nextRunZ[15]).toBeLessThan(z);
    });

    it('tells how many runs agree on a break at each place', () => {
      expect(pool?.agreement[15]).toBeGreaterThan(0.5);
      expect(pool?.agreement[14]).toBeLessThan(0.1);
    });

    it('judges no place without neighbors', () => {
      expect(workings?.runs[0]?.z[0]).toBeUndefined();
      expect(workings?.runs[0]?.z[1]).toBeDefined();
    });
  });

  it('has no groups without digits', () => {
    expect(MARS.create({}).stats([]).groups).toEqual([]);
  });
});
