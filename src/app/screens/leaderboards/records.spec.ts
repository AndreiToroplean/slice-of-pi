import { newTouchLog, TouchLog } from '../../player-data/touch-log';
import { decimals, typeKeys as typed } from '../../../testing/touch-logs';
import { nextSplitPlace, podium, recordOf, recordsOf, RunRecord, splitPlace } from './records';

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

  it('leaves out runs from a checkpoint, unchecked ones and Discovery', () => {
    const fromCheckpoint = typed(['5'], newTouchLog('c', 1, true, undefined, { start: 10 }));
    const unchecked = typed(['1'], newTouchLog('u', 1, false));
    const discovery = typed(
      ['1'],
      newTouchLog('d', 1, true, undefined, { recording: 'overwrite' }),
    );

    expect(recordsOf([fromCheckpoint, unchecked, discovery, typed(['1'])])).toEqual([
      { id: 'run', startedAt: 1_000, perfect: 1, splits: [] },
    ]);
  });

  describe('a podium', () => {
    const record = (id: string, startedAt: number, perfect: number): RunRecord => ({
      id,
      startedAt,
      perfect,
      splits: [],
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
  });
});
