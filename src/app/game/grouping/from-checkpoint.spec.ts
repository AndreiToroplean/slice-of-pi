import { fromStartOfPi } from './break-models/break-model';
import { CHECKPOINT_BREAK, EVEN_INTERVAL, timesFromPlace } from './from-checkpoint';

describe('timesFromPlace', () => {
  it('takes a run from the start of π as it is', () => {
    const own = [0, 200, 400];

    expect(timesFromPlace(0, own, [])).toBe(own);
  });

  it('times the places before the start as the latest earlier run from the start of π that got past it, then breaks', () => {
    const earlier = [
      fromStartOfPi([0, 100, 200, 300]),
      fromStartOfPi([0, 250, 500]),
      fromStartOfPi([0, 300]),
      // Not from the start of π: it has no times before its own start.
      { start: 1, times: [0, 100, 200] },
    ];

    expect(timesFromPlace(2, [0, 200], earlier)).toEqual([
      0,
      250,
      250 + CHECKPOINT_BREAK,
      450 + CHECKPOINT_BREAK,
    ]);
  });

  it('times them at an even pace when no earlier run got that far', () => {
    expect(timesFromPlace(2, [0], [fromStartOfPi([0, 300])])).toEqual([
      0,
      EVEN_INTERVAL,
      EVEN_INTERVAL + CHECKPOINT_BREAK,
    ]);
  });
});
