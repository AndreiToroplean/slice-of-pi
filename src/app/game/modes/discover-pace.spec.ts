import { MEDIUM_INTERVAL, paceInterval } from './discover-pace';

describe('Discover pace', () => {
  it('plays at about a player’s pace by default, slower or faster by as much either way', () => {
    expect(paceInterval('medium')).toBe(MEDIUM_INTERVAL);
    expect(paceInterval('slower')).toBeGreaterThan(MEDIUM_INTERVAL);
    expect(paceInterval('faster')).toBeLessThan(MEDIUM_INTERVAL);
    expect(
      MEDIUM_INTERVAL / paceInterval('slower') + MEDIUM_INTERVAL / paceInterval('faster'),
    ).toBeCloseTo(2);
  });
});
