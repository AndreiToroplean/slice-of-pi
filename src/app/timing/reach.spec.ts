import { reachDifficulty, reaches, TYPICAL_REACH } from './reach';

describe('reach', () => {
  it('costs nothing to type the same key again', () => {
    expect(reachDifficulty('5', '5')).toBe(0);
  });

  it('takes a step to reach the next key, more for a diagonal, two from 7 to 0', () => {
    expect(reachDifficulty('1', '2')).toBe(1);
    expect(reachDifficulty('8', '5')).toBe(1);
    expect(reachDifficulty('1', '5')).toBeCloseTo(Math.log2(1 + Math.SQRT2), 10);
    expect(reachDifficulty('7', '0')).toBeCloseTo(Math.log2(1 + Math.hypot(3, 1)), 10);
  });

  it('is the same both ways', () => {
    expect(reachDifficulty('3', '7')).toBe(reachDifficulty('7', '3'));
  });

  it("follows π's decimals, interval p being the one before decimal index p + 1", () => {
    // 1 4 1 5: 1 to 4 and 4 to 1 are next keys, 1 to 5 a diagonal.
    expect(Array.from(reaches(3))).toEqual([1, 1, reachDifficulty('1', '5')]);
  });

  it('takes a typical reach between the shortest and the longest', () => {
    expect(TYPICAL_REACH.mean).toBeGreaterThan(1);
    expect(TYPICAL_REACH.mean).toBeLessThan(2);
    expect(TYPICAL_REACH.square).toBeGreaterThan(TYPICAL_REACH.mean ** 2);
  });
});
