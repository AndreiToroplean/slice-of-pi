import { judge, terra, TERRA, TERRA_DEFAULTS } from './terra';

describe('Terra', () => {
  /**
   * The times of a run of `length` digits typed about 200 ms apart (an uneven 180, 200, 230), with a pause of `pause` ms
   * before each index in `breaks`, all `slower` times slower.
   */
  function timesOf(length: number, breaks: readonly number[], pause = 700, slower = 1): number[] {
    let time = 0;
    return Array.from({ length }, (_, i) => {
      if (i > 0) {
        time += slower * (breaks.includes(i) ? pause : ([180, 200, 230][i % 3] ?? 0));
      }
      return time;
    });
  }

  /** Every third index, up to `length`: groups of 3. */
  function by3(length: number): number[] {
    return Array.from({ length: Math.floor((length - 1) / 3) }, (_, k) => 3 * (k + 1));
  }

  const grouped = Array.from({ length: 4 }, () => timesOf(30, by3(30)));

  it('tells a pause from the pace around it in the run', () => {
    const { places } = judge(timesOf(30, by3(30)), TERRA_DEFAULTS);
    const pauses = places.flatMap((at, p) => (at.z > TERRA_DEFAULTS.breakShift ? [p + 1] : []));

    expect(pauses).toEqual(by3(30));
    expect(places[10]?.pace).toBeGreaterThan(180);
    expect(places[10]?.pace).toBeLessThan(700);
  });

  it('finds where the runs usually break, and groups them there', () => {
    const stats = TERRA.create({}).stats(grouped);

    expect(stats.usual.map((found) => found.place)).toEqual(by3(30));
    expect(stats.groups.map((group) => group.size)).toEqual(Array<number>(10).fill(3));
    expect(stats.runs[0]?.breaks.map((found) => found.place)).toEqual(by3(30));
  });

  it('judges a run the same however many runs there are', () => {
    const one = TERRA.steps?.({}, [timesOf(30, by3(30))]);
    const many = TERRA.steps?.({}, [...grouped, timesOf(30, by3(30), 900, 1.5)]);

    expect(many?.runs[0]?.breakProbability).toEqual(one?.runs[0]?.breakProbability);
  });

  it('finds the same groups after one run as after many', () => {
    const groups = (runs: number) =>
      TERRA.create({})
        .stats(grouped.slice(0, runs))
        .groups.map((group) => group.size);

    expect(groups(1)).toEqual(groups(4));
  });

  it('ends a group at one pause long enough, where earlier runs carried on', () => {
    // A 10 s pause before index 2, where none of the earlier runs breaks.
    const play = TERRA.create({}).play(grouped);

    expect(play.groupEnds([0, 200, 10200], true)).toBe(true);
    expect(play.groupEnds([0, 200, 600], true)).toBe(false);
  });

  it('ends a group sooner where the player usually breaks', () => {
    // 300 ms after the third digit, where the runs break, and after the second, where they don't.
    const play = TERRA.create({}).play(grouped);

    expect(play.groupEnds([0, 180, 380, 680], true)).toBe(true);
    expect(play.groupEnds([0, 180, 480], true)).toBe(false);
  });

  it("follows the player's groups within the trust horizon", () => {
    expect(TERRA.create({}).play(grouped).groupAt([], 3)).toEqual({ size: 3, trusted: true });
  });

  it('trusts more as more runs agree', () => {
    const horizon = (runs: number) =>
      terra(
        grouped.slice(0, runs).map((times) => judge(times, TERRA_DEFAULTS)),
        undefined,
        TERRA_DEFAULTS,
      ).horizon;

    expect(horizon(1)).toBe(0);
    expect(horizon(4)).toBeGreaterThan(20);
  });

  it("tells a new player's breaks from their first run", () => {
    const play = TERRA.create({}).play([]);

    expect(play.groupEnds(timesOf(8, [7], 2000), false)).toBe(true);
    expect(play.groupEnds(timesOf(8, []), false)).toBe(false);
  });

  it('never takes an interval faster than its pace for a break', () => {
    const { places } = judge([0, 300, 600, 650, 950, 1250], TERRA_DEFAULTS);

    expect(places[2]?.likelihood).toBe(0);
  });

  it('has no groups without digits', () => {
    expect(TERRA.create({}).stats([]).groups).toEqual([]);
  });
});
