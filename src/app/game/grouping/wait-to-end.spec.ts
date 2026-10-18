import { LONGEST_WAIT, waitToEnd } from './wait-to-end';

describe('waitToEnd', () => {
  it('finds the wait at which the group ends, to the millisecond', () => {
    for (const at of [0.5, 37.5, 50, 499, 1234, 98_765, 3e8]) {
      const wait = waitToEnd((waited) => waited >= at);

      expect(wait).toBeGreaterThanOrEqual(at);
      expect(wait - at).toBeLessThanOrEqual(1);
    }
  });

  it('takes a group that ends with no wait for 0', () => {
    expect(waitToEnd(() => true)).toBe(0);
  });

  it('tells a very long wait from none ending the group', () => {
    expect(waitToEnd((waited) => waited >= LONGEST_WAIT)).toBe(LONGEST_WAIT);
    expect(waitToEnd(() => false)).toBe(Infinity);
  });

  it('asks the model a few dozen times at most', () => {
    let asked = 0;
    waitToEnd((waited) => {
      asked++;
      return waited >= LONGEST_WAIT - 3;
    });

    expect(asked).toBeLessThan(60);
  });

  it('gives a wait where the answer flips, even where it flips more than once', () => {
    const ends = (waited: number): boolean => (waited >= 300 && waited < 700) || waited >= 3000;
    const wait = waitToEnd(ends);

    expect(ends(wait)).toBe(true);
    expect(ends(wait - 1)).toBe(false);
  });
});
