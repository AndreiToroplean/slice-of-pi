import { aggregate, analyzeRun, DEFAULT_TIMING_SETTINGS } from '../timing/timing-model';
import { groupEnds, DEFAULT_HINT, groupDigits, hintAt } from './groups';

const settings = DEFAULT_TIMING_SETTINGS;

/** The times of a run of `length` digits typed every 200 ms, with a pause of 1 s before each index in `breaks`. */
function timesOf(length: number, breaks: readonly number[]): number[] {
  let time = 0;
  return Array.from({ length }, (_, i) => {
    if (i > 0) {
      time += breaks.includes(i) ? 1000 : 200;
    }
    return time;
  });
}

/** A player who groups the first 15 decimals by 3, `count` times. */
function runsBy3(count: number, length = 15): ReturnType<typeof analyzeRun>[] {
  return Array.from({ length: count }, () => analyzeRun(timesOf(length, [3, 6, 9, 12]), settings));
}

describe('groupDigits', () => {
  it('has no words and an empty group before anything is typed', () => {
    expect(groupDigits('', [])).toEqual({ words: [], current: '' });
  });

  it('expects groups of 5 by default', () => {
    expect(DEFAULT_HINT).toBe(5);
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

describe('hintAt', () => {
  it('is the default for a new player', () => {
    expect(hintAt(aggregate([], settings), 0, settings)).toBe(DEFAULT_HINT);
  });

  it("follows the player's groups where the aggregate is confident about them", () => {
    const found = aggregate(runsBy3(4), settings);

    expect(hintAt(found, 0, settings)).toBe(3);
    expect(hintAt(found, 3, settings)).toBe(3);
  });

  it('counts the digits left in a group starting inside it', () => {
    expect(hintAt(aggregate(runsBy3(4), settings), 4, settings)).toBe(2);
  });

  it('is the default where the aggregate is not confident enough', () => {
    const found = aggregate(runsBy3(4), { ...settings, hintConfidence: 1 });

    expect(hintAt(found, 3, { ...settings, hintConfidence: 1 })).toBe(DEFAULT_HINT);
  });

  it('is the default in a group no break is known to end, and past the data', () => {
    const found = aggregate(runsBy3(4), settings);

    expect(hintAt(found, 12, settings)).toBe(DEFAULT_HINT);
    expect(hintAt(found, 20, settings)).toBe(DEFAULT_HINT);
  });
});

describe('groupEnds', () => {
  it('has nothing to finish before a digit is typed', () => {
    expect(groupEnds([], [], 5000, settings)).toBe(false);
  });

  it("finishes a new player's first digit after the pause used while there's too little to judge", () => {
    expect(groupEnds([], [0], 900, settings)).toBe(false);
    expect(groupEnds([], [0], 901, settings)).toBe(true);
  });

  it("finishes after a wait clearly longer than this run's local pace", () => {
    const times = timesOf(10, [3]);
    const bar = analyzeRun([...times, 0], settings)[10]?.threshold ?? 0;

    expect(bar).toBeGreaterThan(200);
    expect(groupEnds([], times, Math.floor(bar), settings)).toBe(false);
    expect(groupEnds([], times, Math.ceil(bar) + 1, settings)).toBe(true);
  });

  it('finishes at once where the earlier runs agree on a break, whatever this run says', () => {
    expect(groupEnds(runsBy3(4), timesOf(3, []), 0, settings)).toBe(true);
  });

  it('never finishes where the earlier runs outweigh this one, which then goes on', () => {
    expect(groupEnds(runsBy3(8), timesOf(4, [3]), 60_000, settings)).toBe(false);
  });

  it("follows this run's wait where the earlier runs are split", () => {
    const split = [...runsBy3(1), analyzeRun(timesOf(15, [4, 8, 12]), settings)];

    expect(groupEnds(split, timesOf(3, []), 0, settings)).toBe(false);
    expect(groupEnds(split, timesOf(3, []), 901, settings)).toBe(true);
  });
});
