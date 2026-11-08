import type { Group } from './break-models/break-model';
import { wordsUpTo } from './prefilled-words';

describe('wordsUpTo', () => {
  const group = (start: number, size: number, trusted = true, open = false): Group => ({
    start,
    size,
    trusted,
    open,
  });

  it('cuts the places in groups of the group size where the player has no groups, the last ending at the place', () => {
    expect(wordsUpTo([], 12, [], 5)).toEqual([5, 5, 2]);
    expect(wordsUpTo([], 0, [], 5)).toEqual([]);
  });

  it('follows the groups the model trusts, and only those', () => {
    const groups = [group(0, 3), group(3, 4), group(7, 2, false), group(9, 6, true, true)];

    expect(wordsUpTo([], 20, groups, 5)).toEqual([3, 4, 5, 5, 3]);
  });

  it('keeps the words already on the tape that end by the place, and fills the rest', () => {
    expect(wordsUpTo([4, 4, 4], 10, [], 5)).toEqual([4, 4, 2]);
    expect(wordsUpTo([4, 4], 8, [], 5)).toEqual([4, 4]);
    expect(wordsUpTo([4, 4], 20, [group(8, 3)], 5)).toEqual([4, 4, 3, 5, 4]);
  });
});
