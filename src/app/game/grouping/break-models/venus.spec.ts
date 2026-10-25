import { MERCURY, MERCURY_DEFAULTS } from './mercury';
import { venus, VENUS } from './venus';

describe('Venus', () => {
  // Only the runs given, without synthetic ones.
  const alone = { ...MERCURY_DEFAULTS, syntheticRuns: 0 };

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

  it('finds where the runs usually break, and groups them there', () => {
    const stats = VENUS.create(alone).stats(grouped);

    expect(stats.usual.map((found) => found.place)).toEqual(by3(30));
    expect(stats.groups.map((group) => group.size)).toEqual(Array<number>(10).fill(3));
    expect(stats.runs[0]?.breaks.map((found) => found.place)).toEqual(by3(30));
  });

  it('ends a group at one pause long enough, where earlier runs carried on, unlike Mercury', () => {
    // A 10 s pause before index 2, where none of the earlier runs breaks.
    const pausing = [0, 200, 10200];

    expect(VENUS.create(alone).play(grouped).groupEnds(pausing, 0, true)).toBe(true);
    expect(MERCURY.create(alone).play(grouped).groupEnds(pausing, 0, true)).toBe(false);
  });

  it('carries on through a short wait where earlier runs carried on', () => {
    expect(VENUS.create(alone).play(grouped).groupEnds([0, 200, 600], 0, true)).toBe(false);
  });

  it("follows the player's groups within the trust horizon", () => {
    expect(VENUS.create(alone).play(grouped).groupAt([], 3)).toEqual({ size: 3, trusted: true });
  });

  it('trusts nothing a single run says', () => {
    expect(venus([timesOf(30, by3(30))], undefined, alone).horizon).toBe(0);
    expect(venus(grouped, undefined, alone).horizon).toBeGreaterThan(20);
  });

  it("tells a new player's breaks from their first run, against the synthetic runs", () => {
    const play = VENUS.create(MERCURY_DEFAULTS).play([]);

    expect(play.groupEnds(timesOf(4, [3], 2000), 0, false)).toBe(true);
    expect(play.groupEnds(timesOf(4, []), 0, false)).toBe(false);
  });

  it('has no groups without digits', () => {
    expect(VENUS.create(alone).stats([]).groups).toEqual([]);
  });
});
