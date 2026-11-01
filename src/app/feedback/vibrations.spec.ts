import {
  buzzesOf,
  durationAt,
  LONGEST_STEP,
  mix,
  MOST_STEPS,
  parsePattern,
  sliderOf,
} from './vibrations';

describe('vibrations', () => {
  it('buzzes on every other step of a pattern, from when it plays', () => {
    expect(buzzesOf([20, 30, 40, 10], 100)).toEqual([
      { start: 100, end: 120 },
      { start: 150, end: 190 },
    ]);
    expect(buzzesOf([0, 30, 40], 0)).toEqual([{ start: 30, end: 70 }]);
  });

  it('mixes buzzes into one pattern from now, merging those that overlap', () => {
    expect(mix([{ start: 0, end: 20 }], 0)).toEqual([20]);
    expect(
      mix(
        [
          { start: 50, end: 60 },
          { start: 0, end: 20 },
          { start: 10, end: 30 },
        ],
        0,
      ),
    ).toEqual([30, 20, 10]);
    expect(
      mix(
        [
          { start: 10, end: 20 },
          { start: 20, end: 25 },
        ],
        0,
      ),
    ).toEqual([0, 10, 15]);
  });

  it('plays what is left of a buzz under way, and leaves out those over', () => {
    expect(
      mix(
        [
          { start: 0, end: 10 },
          { start: 5, end: 30 },
          { start: 40, end: 50 },
        ],
        20,
      ),
    ).toEqual([10, 10, 10]);
    expect(mix([{ start: 0, end: 10 }], 10)).toEqual([]);
    expect(mix([], 0)).toEqual([]);
  });

  it('times the pattern to the millisecond', () => {
    expect(mix([{ start: 10.4, end: 20.6 }], 0.2)).toEqual([0, 10, 10]);
  });

  it('reads a pattern of whole durations within bounds, of one step at least', () => {
    expect(parsePattern([10, 0, 20])).toEqual([10, 0, 20]);
    expect(parsePattern([LONGEST_STEP])).toEqual([LONGEST_STEP]);
    expect(parsePattern([])).toBeUndefined();
    expect(parsePattern([LONGEST_STEP + 1])).toBeUndefined();
    expect(parsePattern([-1])).toBeUndefined();
    expect(parsePattern([2.5])).toBeUndefined();
    expect(parsePattern(['10'])).toBeUndefined();
    expect(parsePattern(Array.from({ length: MOST_STEPS + 1 }, () => 1))).toBeUndefined();
    expect(parsePattern(10)).toBeUndefined();
  });

  it('spreads the short durations over more of the slider, and reads them back from it', () => {
    expect(sliderOf(0)).toBe(0);
    expect(sliderOf(LONGEST_STEP)).toBe(1);
    expect(sliderOf(LONGEST_STEP / 4)).toBe(0.5);
    expect(sliderOf(LONGEST_STEP * 2)).toBe(1);
    expect(durationAt(0.5)).toBe(LONGEST_STEP / 4);
    expect(durationAt(2)).toBe(LONGEST_STEP);
    for (const duration of [0, 1, 7, 15, 42, 299]) {
      expect(durationAt(sliderOf(duration))).toBe(duration);
    }
  });
});
