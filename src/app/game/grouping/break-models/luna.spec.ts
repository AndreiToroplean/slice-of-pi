import { luna, LUNA, LUNA_DEFAULTS, verdictsOf } from './luna';

describe('Luna', () => {
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

  function steps(runs: readonly (readonly number[])[]) {
    return luna(
      runs.map((times) => verdictsOf(times, LUNA_DEFAULTS)),
      undefined,
      LUNA_DEFAULTS,
    );
  }

  it('tells a pause from the pace around it', () => {
    const verdicts = verdictsOf(timesOf(30, by3(30)), LUNA_DEFAULTS);

    expect(verdicts.flatMap((verdict, i) => (verdict?.isBreak === true ? [i] : []))).toEqual(
      by3(30),
    );
    expect(verdicts[0]).toBeUndefined();
    expect(verdicts[10]?.pace).toBeGreaterThan(180);
    expect(verdicts[10]?.pace).toBeLessThan(700);
  });

  it('finds where the runs usually break, and groups them there', () => {
    const stats = LUNA.create({}).stats(grouped);

    expect(stats.usual.map((found) => found.place)).toEqual(by3(30));
    expect(stats.groups.map((group) => group.size)).toEqual(Array<number>(10).fill(3));
    expect(stats.runs[0]?.breaks.map((found) => found.place)).toEqual(by3(30));
  });

  it("follows the player's groups within the trust horizon", () => {
    const play = LUNA.create({}).play(grouped);

    expect(play.groupAt([], 3)).toEqual({ size: 3, trusted: true });
    expect(play.groupEnds(timesOf(4, []), true)).toBe(true);
    expect(play.groupEnds(timesOf(3, []), true)).toBe(false);
  });

  it('keeps trusting the places after one the runs are split on', () => {
    // The newest run carries on at index 3, where the three before it break.
    const split = [...grouped.slice(1), timesOf(30, by3(30).slice(1))];
    const found = steps(split);

    expect(found.confidence[3]).toBeLessThan(LUNA_DEFAULTS.level);
    expect(found.horizon).toBeGreaterThan(20);
  });

  it('trusts nothing past the places the runs reached', () => {
    expect(steps(grouped).horizon).toBeLessThanOrEqual(29);
    expect(LUNA.create({}).play(grouped).groupAt([], 30)).toEqual({ size: 5, trusted: false });
  });

  it('ends a group where this run pauses, past the trust horizon', () => {
    const play = LUNA.create({}).play([]);

    expect(play.groupEnds(timesOf(4, [3], 2000), false)).toBe(true);
    expect(play.groupEnds(timesOf(4, []), false)).toBe(false);
  });

  it('starts every group as 5 slots that grow for a new player', () => {
    expect(LUNA.create({}).play([]).groupAt([], 0)).toEqual({ size: 5, trusted: false });
  });

  it('shows its steps without a mixture, a run’s baseline being its pace', () => {
    const found = steps(grouped);

    expect(found.mixture).toBeUndefined();
    expect(found.runs[0]?.baseline[10]).toBe(verdictsOf(grouped[0] ?? [], LUNA_DEFAULTS)[10]?.pace);
    expect(found.runs[0]?.breakProbability[3]).toBe(1);
    expect(found.runs[0]?.breakProbability[4]).toBe(0);
  });

  it('has no groups without digits', () => {
    expect(LUNA.create({}).stats([]).groups).toEqual([]);
  });
});
