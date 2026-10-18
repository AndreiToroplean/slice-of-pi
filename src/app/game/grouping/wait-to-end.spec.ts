import { waitToEnd } from './wait-to-end';

describe('waitToEnd', () => {
  it('finds the wait at which the group ends, to the millisecond', () => {
    for (const at of [1, 37.5, 499, 500, 501, 1234, 98_765]) {
      const wait = waitToEnd((waited) => waited >= at);

      expect(wait).toBeGreaterThanOrEqual(at);
      expect(wait - at).toBeLessThanOrEqual(1);
    }
  });

  it('takes a group that ends at once for 0', () => {
    expect(waitToEnd(() => true)).toBe(0);
  });

  it('takes a group no pause ends for never', () => {
    expect(waitToEnd(() => false)).toBe(Infinity);
  });

  it('asks the model a few dozen times at most', () => {
    let asked = 0;
    waitToEnd((waited) => {
      asked++;
      return waited >= 98_765;
    });

    expect(asked).toBeLessThan(40);
  });

  it('gives a wait where the answer flips, even where it flips more than once', () => {
    const ends = (waited: number): boolean => (waited >= 300 && waited < 700) || waited >= 3000;
    const wait = waitToEnd(ends);

    expect(ends(wait)).toBe(true);
    expect(ends(wait - 1)).toBe(false);
  });
});
