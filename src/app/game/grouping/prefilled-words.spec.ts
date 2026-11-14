import type { Group } from './break-models/break-model';
import { groupStart, wordsUpTo } from './prefilled-words';

const group = (start: number, size: number, trusted = true, open = false): Group => ({
  start,
  size,
  trusted,
  open,
});

describe('wordsUpTo', () => {
  it('cuts the places in groups of the group size where the player has no groups, the last ending at the place', () => {
    expect(wordsUpTo([], 12, [], 5)).toEqual([5, 5, 2]);
    expect(wordsUpTo([], 0, [], 5)).toEqual([]);
  });

  it('follows the groups the model trusts, and only those', () => {
    const groups = [group(0, 3), group(3, 4), group(7, 2, false), group(9, 6, true, true)];

    expect(wordsUpTo([], 20, groups, 5)).toEqual([3, 4, 3, 5, 5]);
  });

  it('keeps the words already on the tape that end by the place, and fills the rest', () => {
    expect(wordsUpTo([4, 4, 4], 10, [], 5)).toEqual([4, 4, 2]);
    expect(wordsUpTo([4, 4], 8, [], 5)).toEqual([4, 4]);
    expect(wordsUpTo([4, 4], 20, [group(8, 3)], 5)).toEqual([4, 4, 3, 4, 5]);
  });

  it("gets back on the track of groups of the group size past the player's groups, wherever they end", () => {
    expect(wordsUpTo([], 15, [group(0, 4), group(4, 3)], 5)).toEqual([4, 3, 3, 5]);
    expect(wordsUpTo([], 15, [group(0, 4), group(4, 6)], 5)).toEqual([4, 6, 5]);
  });
});

describe('groupStart', () => {
  it('finds where the word holding the place starts, or the place itself where a word ends there', () => {
    expect(groupStart([], 12, [], 5)).toBe(10);
    expect(groupStart([], 10, [], 5)).toBe(10);
    expect(groupStart([], 0, [], 5)).toBe(0);
  });

  it("starts a checkpoint at a round place on it, however far the player's groups reach", () => {
    expect(groupStart([], 300, [group(0, 120), group(120, 7)], 5)).toBe(300);
    expect(groupStart([], 300, [group(0, 120), group(120, 9)], 5)).toBe(300);
  });

  it('follows the words already on the tape, then the groups the model trusts', () => {
    expect(groupStart([4, 4], 7, [], 5)).toBe(4);
    expect(groupStart([4], 200, [group(0, 4), group(198, 6)], 5)).toBe(198);
    expect(groupStart([], 200, [group(198, 6)], 2)).toBe(198);
  });
});
