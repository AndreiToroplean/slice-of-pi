import { BreakSettings } from './hyperparameters';
import { finishedRuns, mercury, MERCURY, MERCURY_DEFAULTS } from './mercury';

// Only the runs given, without synthetic ones.
const settings = { ...MERCURY_DEFAULTS, syntheticRuns: 0 };

/**
 * The times of a run of `length` digits typed about 200 ms apart (an uneven 180, 200, 230), with a pause of 1 s before
 * each index in `breaks`.
 */
function timesOf(length: number, breaks: readonly number[]): number[] {
  let time = 0;
  return Array.from({ length }, (_, i) => {
    if (i > 0) {
      time += breaks.includes(i) ? 1000 : ([180, 200, 230][i % 3] ?? 0);
    }
    return time;
  });
}

/** Every third index, up to `length`: groups of 3. */
function by3(length: number): number[] {
  return Array.from({ length: Math.floor((length - 1) / 3) }, (_, k) => 3 * (k + 1));
}

/** How Mercury plays the groups of a player who grouped the first `length` decimals by 3, `count` times. */
function gameplay(count: number, length = 30, tuned: BreakSettings = settings) {
  const runs = Array.from({ length: count }, () => timesOf(length, by3(length)));
  return MERCURY.create(tuned).play(runs);
}

describe('groupAt', () => {
  it('is a group of 5 that grows for a new player', () => {
    expect(gameplay(0).groupAt([], 0)).toEqual({ size: 5, trusted: false });
  });

  it("follows the player's groups within the trust horizon", () => {
    const found = gameplay(3);

    expect(found.groupAt([], 0)).toEqual({ size: 3, trusted: true });
    expect(found.groupAt([], 3)).toEqual({ size: 3, trusted: true });
  });

  it('counts the digits left in a group starting inside it', () => {
    expect(gameplay(3).groupAt([], 4).size).toBe(2);
  });

  it('is a group of 5 that grows past the trust horizon', () => {
    const found = gameplay(3);

    expect(found.groupAt([], 24)).toEqual({ size: 3, trusted: true });
    expect(found.groupAt([], 27)).toEqual({ size: 5, trusted: false });
    expect(found.groupAt([], 40)).toEqual({ size: 5, trusted: false });
  });

  it('trusts the groups as far as the earlier runs do, whatever the run being typed', () => {
    expect(gameplay(3).groupAt(timesOf(4, []), 3)).toEqual({ size: 3, trusted: true });
  });

  it('grows everywhere when too few runs agree', () => {
    expect(gameplay(1).groupAt([], 3)).toEqual({ size: 5, trusted: false });
  });
});

describe('groupEnds', () => {
  it('finishes where the player usually breaks, within the trust horizon', () => {
    expect(gameplay(3).groupEnds(timesOf(4, []), true)).toBe(true);
    expect(gameplay(3).groupEnds(timesOf(3, []), true)).toBe(false);
  });

  it('finishes where this run breaks long enough to outweigh the earlier runs, within the trust horizon', () => {
    // A break before index 2, where the earlier runs never break.
    const breaking = timesOf(3, [2]);

    expect(gameplay(1).groupEnds(breaking, true)).toBe(true);
    expect(gameplay(3).groupEnds(breaking, true)).toBe(false);
  });

  it('finishes where this run breaks, past the trust horizon', () => {
    const found = gameplay(3);

    expect(found.groupEnds(timesOf(36, [35]), false)).toBe(true);
    expect(found.groupEnds(timesOf(37, [35]), false)).toBe(false);
    expect(found.groupEnds(timesOf(34, [35]), false)).toBe(false);
  });

  it("finishes a new player's group where they break, judged by the synthetic runs", () => {
    const found = gameplay(0, 30, MERCURY_DEFAULTS);

    expect(found.groupEnds(timesOf(4, [3]), false)).toBe(true);
    expect(found.groupEnds(timesOf(3, []), false)).toBe(false);
  });
});

describe('the thresholds', () => {
  it('starts groups with the starting slots', () => {
    expect(gameplay(0, 30, { ...settings, startingSlots: 3 }).groupAt([], 0).size).toBe(3);
  });

  it('asks for a likelier break past the trust horizon at a higher break threshold', () => {
    // A borderline wait: the first one this new player's break is about even odds for, judged by the synthetic runs.
    const borderline = Array.from({ length: 60 }, (_, k) => {
      const current = [0, 200, 430, 630 + 10 * k];
      const steps = mercury(finishedRuns([], settings.window), current, MERCURY_DEFAULTS);
      return { current, p: steps.runs[0]?.breakProbability[3] ?? 0 };
    }).find(({ p }) => p > 0.3 && p < 0.7);
    if (borderline === undefined) {
      throw new Error('No borderline wait');
    }
    const { current, p } = borderline;
    const at = (breakThreshold: number): boolean =>
      gameplay(0, 30, { ...MERCURY_DEFAULTS, breakThreshold }).groupEnds(current, false);

    expect(at(0.5)).toBe(p > 0.5);
    expect(at(0.2)).toBe(true);
    expect(at(0.8)).toBe(false);
  });

  it('asks for more runs breaking at a place within the trust horizon at a higher usual threshold', () => {
    // Two runs out of three break at index 3, so about 63% of the weight.
    const runs = [timesOf(30, by3(30).slice(1)), timesOf(30, by3(30)), timesOf(30, by3(30))];
    const at = (usualThreshold: number): number | undefined =>
      MERCURY.create({ ...settings, usualThreshold }).stats(runs).groups[0]?.size;

    expect(at(0.5)).toBe(3);
    expect(at(0.8)).toBe(6);
  });
});
