import { mars, MARS, MARS_DEFAULTS } from './mars';
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
  function waitToEnd(earlier: readonly (readonly number[])[], typed: number): number {
    const play = MARS.create({}).play(earlier);
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

  it('ends a group at once where the runs usually break', () => {
    expect(waitToEnd(grouped, 15)).toBeLessThan(100);
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
    const horizon = (runs: readonly (readonly number[])[]) =>
      mars(
        runs.map((times) => judge(times, MARS_DEFAULTS)),
        undefined,
        MARS_DEFAULTS,
      ).horizon;

    expect(horizon(grouped.slice(0, 1))).toBe(0);
    expect(horizon(grouped)).toBeGreaterThan(20);
  });

  it("follows the player's groups within the trust horizon", () => {
    expect(MARS.create({}).play(grouped).groupAt([], 3)).toEqual({ size: 3, trusted: true });
  });

  it("tells a new player's breaks from their first run", () => {
    const play = MARS.create({}).play([]);

    expect(play.groupEnds(timesOf(8, [7], 2000), false)).toBe(true);
    expect(play.groupEnds(timesOf(8, []), false)).toBe(false);
  });

  it('has no groups without digits', () => {
    expect(MARS.create({}).stats([]).groups).toEqual([]);
  });
});
