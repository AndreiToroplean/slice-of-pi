import { BREATH, breathStep, isBreath, MAX_BREATH } from './breath';

describe('breathStep', () => {
  it('moves the sides of a narrow button and a wide one by as much, scaling the narrow one more', () => {
    for (const width of [40, 120, 300]) {
      const grown = width * (1 + BREATH * breathStep(width));
      expect((grown - width) / 2).toBeCloseTo(BREATH, 10);
    }
    expect(breathStep(40)).toBeGreaterThan(breathStep(300));
  });

  it("doesn't scale a button not laid out yet", () => {
    expect(breathStep(0)).toBe(0);
  });
});

describe('isBreath', () => {
  it('takes half pixels, from none to the most', () => {
    expect([0, 2.5, BREATH, MAX_BREATH].every(isBreath)).toBe(true);
    expect([-1, 0.3, MAX_BREATH + 0.5, '3'].some(isBreath)).toBe(false);
  });
});
