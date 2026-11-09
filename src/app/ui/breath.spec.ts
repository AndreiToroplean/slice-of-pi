import { BREATH_REACH, breathStep } from './breath';

describe('breathStep', () => {
  it('moves the sides of a narrow button and a wide one by as much, scaling the narrow one more', () => {
    for (const width of [40, 120, 300]) {
      const grown = width * (1 + 3 * breathStep(width));
      expect((grown - width) / 2).toBeCloseTo(3 * BREATH_REACH, 10);
    }
    expect(breathStep(40)).toBeGreaterThan(breathStep(300));
  });

  it("doesn't scale a button not laid out yet", () => {
    expect(breathStep(0)).toBe(0);
  });
});
