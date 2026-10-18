import { LONGEST_WAIT, PRECISION, waitToEnd } from './wait-to-end';

describe('waitToEnd', () => {
  it('finds the wait at which the group ends, to a twentieth of it', () => {
    for (const at of [50, 499, 1234, 98_765, 3e8]) {
      const wait = waitToEnd((waited) => waited >= at);

      expect(wait).toBeGreaterThanOrEqual(at);
      expect(wait).toBeLessThanOrEqual(at * (1 + PRECISION));
    }
  });

  it('ends a group that ends within 50 ms at about 50 ms', () => {
    for (const at of [0.5, 37.5]) {
      const wait = waitToEnd((waited) => waited >= at);

      expect(wait).toBeGreaterThanOrEqual(50);
      expect(wait).toBeLessThanOrEqual(50 * (1 + PRECISION));
    }
  });

  it('takes a group that ends with no wait for 0', () => {
    expect(waitToEnd(() => true)).toBe(0);
  });

  it('tells a very long wait from none ending the group', () => {
    expect(waitToEnd((waited) => waited >= LONGEST_WAIT)).toBe(LONGEST_WAIT);
    expect(waitToEnd(() => false)).toBe(Infinity);
  });

  it('asks the model a dozen times at most, however long the wait', () => {
    for (const at of [10, 700, 3e4, LONGEST_WAIT - 3, Infinity]) {
      let asked = 0;
      waitToEnd((waited) => {
        asked++;
        return waited >= at;
      });

      expect(asked).toBeLessThanOrEqual(12);
    }
  });

  it('gives a wait where the answer flips, even where it flips more than once', () => {
    const ends = (waited: number): boolean => (waited >= 300 && waited < 700) || waited >= 3000;
    const wait = waitToEnd(ends);

    expect(ends(wait)).toBe(true);
    expect(ends(wait / (1 + PRECISION))).toBe(false);
  });
});
