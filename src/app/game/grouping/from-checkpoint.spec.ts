import { MEDIUM_INTERVAL } from '../modes/discover-pace';
import { CHECKPOINT_BREAK, timesFromPlace } from './from-checkpoint';

describe('timesFromPlace', () => {
  it('takes a run from the start of π as it is', () => {
    const own = [0, 200, 400];

    expect(timesFromPlace(0, own, [])).toBe(own);
  });

  it('times the places before the start as the latest earlier run that got past it, then breaks', () => {
    const earlier = [
      [0, 100, 200, 300],
      [0, 250, 500],
      [0, 300],
    ];

    expect(timesFromPlace(2, [0, 200], earlier)).toEqual([
      0,
      250,
      250 + CHECKPOINT_BREAK,
      450 + CHECKPOINT_BREAK,
    ]);
  });

  it('times them at an even pace when no earlier run got that far', () => {
    expect(timesFromPlace(2, [0], [[0, 300]])).toEqual([
      0,
      MEDIUM_INTERVAL,
      MEDIUM_INTERVAL + CHECKPOINT_BREAK,
    ]);
  });
});
