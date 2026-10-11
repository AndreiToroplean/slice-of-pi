import {
  BreakModel,
  breakModel,
  DEFAULT_BREAK_SETTINGS,
  finishedRuns,
} from '../timing/break-model';
import { DEFAULT_GROUP_SIZE, groupDigits, groupEnds, groupSizeAt } from './groups';

const settings = DEFAULT_BREAK_SETTINGS;

/**
 * The times of a run of `length` digits typed about 200 ms apart (an uneven 180, 200, 230), with a pause of 1 s before
 * each index in `breaks`.
 */
function timesOf(length: number, breaks: readonly number[]): number[] {
  let time = 0;
  return Array.from({ length }, (_, i) => {
    if (i > 0) {
      time += breaks.includes(i) ? 1000 : ([180, 200, 230][i % 3] ?? 0);
    }
    return time;
  });
}

/** Every third index, up to `length`: groups of 3. */
function by3(length: number): number[] {
  return Array.from({ length: Math.floor((length - 1) / 3) }, (_, k) => 3 * (k + 1));
}

/** A player who groups the first `length` decimals by 3, `count` times, then types `current`. */
function model(count: number, current: readonly number[], length = 30): BreakModel {
  const runs = Array.from({ length: count }, () => timesOf(length, by3(length)));
  return breakModel(finishedRuns(runs, settings.window), current, settings);
}

describe('groupDigits', () => {
  it('has no words and an empty group before anything is typed', () => {
    expect(groupDigits('', [])).toEqual({ words: [], current: '' });
  });

  it('plays groups of 5 by default', () => {
    expect(DEFAULT_GROUP_SIZE).toBe(5);
  });

  it('keeps every digit in the group being typed until a group is finished', () => {
    expect(groupDigits('1415926', [])).toEqual({ words: [], current: '1415926' });
  });

  it('cuts the finished groups at their sizes, and the rest is the group being typed', () => {
    expect(groupDigits('141592653', [3, 1, 4])).toEqual({
      words: [
        { firstPlace: 1, digits: '141' },
        { firstPlace: 4, digits: '5' },
        { firstPlace: 5, digits: '9265' },
      ],
      current: '3',
    });
  });

  it('has an empty group being typed right after a group is finished', () => {
    expect(groupDigits('14159', [5])).toEqual({
      words: [{ firstPlace: 1, digits: '14159' }],
      current: '',
    });
  });
});

describe('groupSizeAt', () => {
  it('is the default for a new player', () => {
    expect(groupSizeAt(model(0, []), 0)).toBe(DEFAULT_GROUP_SIZE);
  });

  it("follows the player's groups within the trust horizon", () => {
    const found = model(3, []);

    expect(groupSizeAt(found, 0)).toBe(3);
    expect(groupSizeAt(found, 3)).toBe(3);
  });

  it('counts the digits left in a group starting inside it', () => {
    expect(groupSizeAt(model(3, []), 4)).toBe(2);
  });

  it('is the default past the trust horizon', () => {
    const found = model(3, []);

    expect(found.horizon).toBe(29);
    expect(groupSizeAt(found, 27)).toBe(DEFAULT_GROUP_SIZE);
    expect(groupSizeAt(found, 40)).toBe(DEFAULT_GROUP_SIZE);
  });

  it('is the default everywhere when too few runs agree', () => {
    expect(groupSizeAt(model(1, []), 3)).toBe(DEFAULT_GROUP_SIZE);
  });
});

describe('groupEnds', () => {
  it('finishes where the player usually breaks', () => {
    const found = model(3, timesOf(4, []));

    expect(groupEnds(found, 3)).toBe(true);
    expect(groupEnds(found, 2)).toBe(false);
  });

  it("never finishes where there's too little data to tell breaks", () => {
    expect(groupEnds(model(0, timesOf(4, [3])), 3)).toBe(false);
  });
});
