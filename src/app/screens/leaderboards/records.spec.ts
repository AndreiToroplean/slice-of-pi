import { Digit } from '../../game/pi/digit';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { newTouchLog, TouchLog } from '../../player-data/touch-log';
import { decimals, typeKeys as typed } from '../../../testing/touch-logs';
import {
  bestPerfectRun,
  masteryOf,
  masteryTenths,
  lastSplitOf,
  nextSplitPlace,
  podium,
  recordOf,
  recordsOf,
  RunRecord,
  isSplitPlace,
  splitPlace,
} from './records';

describe('records', () => {
  describe('a perfect run', () => {
    it('times each split place it reaches, from its first digit', () => {
      const log = typed([...decimals(60), '0', ...decimals(50)]);

      expect(recordOf(log)?.splits).toEqual([2_400, 4_900]);
    });

    it('reaches the place of the first mistake', () => {
      expect(recordOf(typed([...decimals(5), '0', ...decimals(3)]))?.perfect).toBe(5);
    });

    it('ends at the first backspace, even over a right digit', () => {
      expect(recordOf(typed([...decimals(4), 'backspace', '5']))?.perfect).toBe(4);
    });

    it('runs to the end of a run without mistakes, past touches typing nothing', () => {
      const log = typed(decimals(3));
      const touched = { ...log, touches: [...log.touches, { key: null, x: 0, y: 0, time: 400 }] };

      expect(recordOf(touched as TouchLog)?.perfect).toBe(3);
    });
  });

  it('makes the farthest perfect run the record, 0 before any', () => {
    expect(bestPerfectRun([typed([...decimals(3), '0']), typed(decimals(5))])).toBe(5);
    expect(bestPerfectRun([])).toBe(0);
  });

  it('leaves out runs from a checkpoint, unchecked ones and Discovery', () => {
    const fromCheckpoint = typed(['5'], newTouchLog('c', 1, true, undefined, { start: 10 }));
    const unchecked = typed(['1'], newTouchLog('u', 1, false));
    const discovery = typed(
      ['1'],
      newTouchLog('d', 1, true, undefined, { recording: 'overwrite' }),
    );

    expect(recordsOf([fromCheckpoint, unchecked, discovery, typed(['1'])])).toEqual([
      {
        id: 'run',
        startedAt: 1_000,
        perfect: 1,
        splits: [],
        mastery: { value: 1, reached: 1, mistakes: 0, stoppedOn: 0 },
      },
    ]);
  });

  describe('the mastery', () => {
    const mastery = (keys: Parameters<typeof typed>[0]): number[] => {
      const { value, reached, mistakes } = masteryOf(typed(keys));
      return [Number(value.toFixed(3)), reached, mistakes];
    };

    it('counts each digit right on the first try as one', () => {
      expect(mastery(decimals(3))).toEqual([3, 3, 0]);
    });

    // π's first decimals: 1, 4, 1.
    it('counts a digit right as the t-th tried at its place as 1 − log₁₀ t, each digit once', () => {
      expect(mastery(['1', '0', 'backspace', '0', 'backspace', '4'])).toEqual([1.699, 2, 1]);
    });

    it('counts nothing for a digit right on the tenth try', () => {
      const wrongs = ['0', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
      expect(mastery([...wrongs.flatMap((digit) => [digit, 'backspace' as const]), '1'])).toEqual([
        0, 1, 9,
      ]);
    });

    it('counts a right digit typed again after backspace nothing more', () => {
      expect(mastery(['1', '4', 'backspace', 'backspace', '1', '4'])).toEqual([2, 2, 0]);
    });

    it('leaves out the digits typed after a mistake until deleted', () => {
      expect(mastery(['1', '4', '0', '1', 'backspace', 'backspace', '1'])).toEqual([2.699, 3, 1]);
    });

    it('leaves out the mistakes it ends on, at a place never typed right', () => {
      expect(mastery(['1', '4', '0', 'backspace', '9'])).toEqual([2, 2, 0]);
    });

    it('keeps the wrong digits it ends on apart, as those at the place being typed', () => {
      expect(masteryOf(typed(['1', '4', '0', 'backspace', '9', '2'])).stoppedOn).toBe(2);
      expect(masteryOf(typed(['1', '4', '0', 'backspace', '9', 'backspace', '1'])).stoppedOn).toBe(
        0,
      );
    });

    it('counts from the place a run started from', () => {
      const fromTen = newTouchLog('c', 0, true, undefined, { start: 10 });
      expect(masteryOf(typed(PI_DECIMALS.slice(10, 13).split('') as Digit[], fromTen))).toEqual({
        value: 3,
        reached: 13,
        mistakes: 0,
        stoppedOn: 0,
      });
    });
  });

  describe('the last split', () => {
    it('is the last split place reached, and when, from the first digit', () => {
      expect(lastSplitOf(typed(decimals(60)))).toEqual({ place: 50, time: 4900 });
    });

    it('is the place it counts from, reached at no time, before any other', () => {
      expect(lastSplitOf(typed(decimals(24)))).toEqual({ place: 0, time: 0 });
    });

    it('counts past mistakes, and only the first time a place is reached', () => {
      const keys = [
        '0',
        'backspace',
        ...decimals(26),
        'backspace',
        'backspace',
        ...decimals(26).slice(24),
      ];
      expect(lastSplitOf(typed(keys as Parameters<typeof typed>[0]))).toEqual({
        place: 25,
        time: 2600,
      });
    });

    it('counts from the place the run started from', () => {
      const fromNinety = newTouchLog('c', 0, true, undefined, { start: 90 });
      const keys = PI_DECIMALS.slice(90, 101).split('') as Digit[];
      expect(lastSplitOf(typed(keys, fromNinety))).toEqual({ place: 100, time: 900 });
    });

    it('times the place it counts from once reached, from a run started before it', () => {
      const fromNinetySeven = newTouchLog('c', 0, true, undefined, { start: 97 });
      const keys = PI_DECIMALS.slice(97, 102).split('') as Digit[];
      expect(lastSplitOf(typed(keys.slice(0, 2), fromNinetySeven), 100)).toEqual({
        place: 100,
        time: undefined,
      });
      expect(lastSplitOf(typed(keys, fromNinetySeven), 100)).toEqual({ place: 100, time: 200 });
    });
  });

  it('ranks a mastery to a tenth, never rounded up', () => {
    expect(masteryTenths(1.699)).toBe(1.6);
    expect(masteryTenths(2.9999999999999996)).toBe(3);
  });

  describe('a podium', () => {
    const record = (id: string, startedAt: number, perfect: number): RunRecord => ({
      id,
      startedAt,
      perfect,
      splits: [],
      mastery: { value: 0, reached: 0, mistakes: 0, stoppedOn: 0 },
    });
    const records = [record('a', 1, 10), record('b', 2, 30), record('c', 3, 0), record('d', 4, 20)];
    const valued = (record: RunRecord): number | undefined => record.perfect || undefined;

    it('ranks the three best, leaving out runs without a value', () => {
      expect(podium(records, valued).map(({ id }) => id)).toEqual(['b', 'd', 'a']);
      expect(podium(records.slice(0, 3), valued).map(({ value }) => value)).toEqual([30, 10]);
    });

    it('puts the lowest first when lower is better', () => {
      expect(podium(records, valued, { lowest: true }).map(({ id }) => id)).toEqual([
        'a',
        'd',
        'b',
      ]);
    });

    it('puts the earlier run first between equals', () => {
      expect(podium([record('later', 9, 5), record('earlier', 1, 5)], valued)[0]?.id).toBe(
        'earlier',
      );
    });
  });

  it('places splits at 25, 50, 100, then every hundred', () => {
    expect([0, 1, 2, 3, 4].map(splitPlace)).toEqual([25, 50, 100, 200, 300]);
    expect([0, 25, 99, 412].map(nextSplitPlace)).toEqual([25, 50, 100, 500]);
    expect([0, 25, 30, 100, 150, 400].map(isSplitPlace)).toEqual([
      false,
      true,
      false,
      true,
      false,
      true,
    ]);
  });
});
