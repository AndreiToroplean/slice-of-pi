import {
  BreakModel,
  breakModel,
  DEFAULT_BREAK_SETTINGS,
  finishedRuns,
} from '../timing/break-model';
import { DEFAULT_GROUP_SIZE, groupAt, groupDigits, groupEnds, slotCount } from './groups';

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

describe('groupAt', () => {
  it('is a group of 5 that grows for a new player', () => {
    expect(groupAt(model(0, []), 0)).toEqual({
      size: DEFAULT_GROUP_SIZE,
      trusted: false,
    });
  });

  it("follows the player's groups within the trust horizon", () => {
    const found = model(3, []);

    expect(groupAt(found, 0)).toEqual({ size: 3, trusted: true });
    expect(groupAt(found, 3)).toEqual({ size: 3, trusted: true });
  });

  it('counts the digits left in a group starting inside it', () => {
    expect(groupAt(model(3, []), 4).size).toBe(2);
  });

  it('is a group of 5 that grows past the trust horizon', () => {
    const found = model(3, []);

    expect(found.horizon).toBe(29);
    expect(groupAt(found, 27)).toEqual({ size: DEFAULT_GROUP_SIZE, trusted: false });
    expect(groupAt(found, 40)).toEqual({ size: DEFAULT_GROUP_SIZE, trusted: false });
  });

  it('grows everywhere when too few runs agree', () => {
    expect(groupAt(model(1, []), 3)).toEqual({
      size: DEFAULT_GROUP_SIZE,
      trusted: false,
    });
  });
});

describe('slotCount', () => {
  it('is the size of a trusted group', () => {
    expect(slotCount({ size: 3, trusted: true }, 3)).toBe(3);
  });

  it('is one more than the digits typed in an untrusted group, from its size on', () => {
    const plan = { size: 5, trusted: false };

    expect(slotCount(plan, 0)).toBe(5);
    expect(slotCount(plan, 4)).toBe(5);
    expect(slotCount(plan, 5)).toBe(6);
    expect(slotCount(plan, 12)).toBe(13);
  });
});

describe('groupEnds', () => {
  it('finishes where the player usually breaks, within the trust horizon', () => {
    const found = model(3, timesOf(4, []));

    expect(groupEnds(found, 3, true)).toBe(true);
    expect(groupEnds(found, 2, true)).toBe(false);
  });

  it('finishes where this run breaks, past the trust horizon', () => {
    const found = model(3, timesOf(45, [35]), 30);

    expect(groupEnds(found, 35, false)).toBe(true);
    expect(groupEnds(found, 36, false)).toBe(false);
    expect(groupEnds(found, 33, false)).toBe(false);
  });

  it("finishes a new player's group where they break", () => {
    const found = model(0, timesOf(4, [3]));

    expect(groupEnds(found, 3, false)).toBe(true);
    expect(groupEnds(found, 2, false)).toBe(false);
  });
});
