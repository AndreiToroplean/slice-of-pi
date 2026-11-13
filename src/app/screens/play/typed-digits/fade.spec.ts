import { fadeOpacity } from './fade';

describe('fadeOpacity', () => {
  it('starts from the whole opacity and ends at none', () => {
    expect(fadeOpacity(1)).toBe(1);
    expect(fadeOpacity(0)).toBe(0);
  });

  it('eases in: slow to start, fastest as it ends', () => {
    const start = fadeOpacity(1) - fadeOpacity(0.9);
    const end = fadeOpacity(0.1) - fadeOpacity(0);

    expect(start).toBeLessThan(end);
    expect(fadeOpacity(0.5)).toBeGreaterThan(0.5);
  });

  it('keeps to the fade’s bounds', () => {
    expect(fadeOpacity(2)).toBe(1);
    expect(fadeOpacity(-1)).toBe(0);
  });
});
