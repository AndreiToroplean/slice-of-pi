import { fromStartOfPi } from './break-model';
import { BREAK_MODELS, breakModelKindById, GROUPS_OF_FIVE } from './break-models';

describe('the break models', () => {
  it('gives each one its own id, to find it by', () => {
    expect(new Set(BREAK_MODELS.map((kind) => kind.id)).size).toBe(BREAK_MODELS.length);
    for (const kind of BREAK_MODELS) {
      expect(breakModelKindById(kind.id)).toBe(kind);
    }
    expect(breakModelKindById('pluto')).toBeUndefined();
  });

  it('plays groups of 5 alone for tests, wherever the runs break', () => {
    // Steady, but for a long pause before the fourth digit and the ninth, where groups of 3 and 5 would start.
    const times = [
      0, 300, 600, 2_000, 2_300, 2_600, 2_900, 3_200, 4_600, 4_900, 5_200, 5_500, 5_800, 6_100,
    ];
    const sizes = GROUPS_OF_FIVE.create({})
      .stats([fromStartOfPi(times), fromStartOfPi(times)])
      .groups.map((group) => group.size);

    // The last group runs on past the 14 digits.
    expect(sizes).toEqual([5, 5, 4]);
  });
});
