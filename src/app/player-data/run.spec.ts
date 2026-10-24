import { KeypadKey } from '../game/layers/keypad-layout';
import { countsInGroups, groupRuns, moveRun, orderRuns, replay, Run, runOf } from './run';
import { addTouch, newTouchLog, TouchLog } from './touch-log';

describe('run', () => {
  /** A run with no digits, from a touch log with no touches. */
  function log(id: string, startedAt: number, checked = true): Run {
    return runOf(newTouchLog(id, startedAt, checked));
  }

  /** A touch log of these touches, each a key, or a miss (`null`), at a time. */
  function touches(checked: boolean, ...keys: [KeypadKey | null, number][]): TouchLog {
    return keys.reduce(
      (touched, [key, time]) => addTouch(touched, { key, x: 0, y: 0 }, time),
      newTouchLog('run-1', 1_760_000_000_000, checked, 'telephone'),
    );
  }

  describe('replay', () => {
    it('makes a run of the digits typed and their times, on the touch log’s run', () => {
      expect(runOf(touches(true, ['1', 0], ['4', 212], ['1', 531]))).toEqual({
        id: 'run-1',
        checked: true,
        keypadLayout: 'telephone',
        startedAt: 1_760_000_000_000,
        digits: '141',
        times: [0, 212, 531],
      });
    });

    it('leaves out the touches typing nothing', () => {
      const run = runOf(touches(true, ['1', 0], [null, 100], ['4', 212]));

      expect([run.digits, run.times]).toEqual(['14', [0, 212]]);
    });

    it('deletes the last digit on backspace, the next one timed from the backspace', () => {
      const { run, rewound } = replay(
        touches(true, ['1', 0], ['4', 200], ['1', 400], ['backspace', 600], ['1', 700]),
      );

      expect([run.digits, run.times, rewound]).toEqual(['141', [0, 200, 300], 400]);
    });

    it('leaves out wrong digits in a checked run, and any typed after them, until deleted', () => {
      const log = touches(true, ['1', 0], ['4', 200], ['9', 300], ['1', 400]);
      const { run, rewound } = replay(log);
      expect([run.digits, run.times, rewound]).toEqual(['14', [0, 200], 0]);

      const deleted = replay(
        [
          ['backspace', 500],
          ['backspace', 600],
          ['1', 650],
        ].reduce(
          (touched, [key, time]) =>
            addTouch(touched, { key: key as KeypadKey, x: 0, y: 0 }, time as number),
          log,
        ),
      );
      expect([deleted.run.digits, deleted.run.times, deleted.rewound]).toEqual([
        '141',
        [0, 200, 250],
        400,
      ]);
    });

    it('keeps every digit of an unchecked run', () => {
      expect(runOf(touches(false, ['9', 0], ['9', 100])).digits).toBe('99');
    });

    it('ignores backspace with no digit to delete', () => {
      const { run, rewound } = replay(touches(true, ['backspace', 50], ['1', 100]));

      expect([run.digits, run.times, rewound]).toEqual(['1', [100], 0]);
    });
  });

  it('computes the groups from the checked runs, unless the unchecked ones are included', () => {
    const checked = log('checked', 0);
    const unchecked = log('unchecked', 1, false);

    expect(countsInGroups(checked, false)).toBe(true);
    expect(countsInGroups(unchecked, false)).toBe(false);
    expect(countsInGroups(unchecked, true)).toBe(true);
  });

  describe('the order of the runs', () => {
    const runs = [log('a', 0), log('b', 1, false), log('c', 2), log('d', 3)];
    const ids = (some: readonly Run[]): string[] => some.map((run) => run.id);

    it('keeps the runs in the order they were played, all counted, unless put in another', () => {
      expect(orderRuns(runs, undefined)).toEqual({ runs, line: undefined });
      expect(ids(groupRuns(runs, false, undefined))).toEqual(['a', 'c', 'd']);
      expect(ids(groupRuns(runs, true, undefined))).toEqual(['a', 'b', 'c', 'd']);
    });

    it('takes the runs in the order they were put in, all counted when there is no line', () => {
      const order = { ids: ['d', 'a', 'c', 'b'] };

      expect(ids(orderRuns(runs, order).runs)).toEqual(['d', 'a', 'c', 'b']);
      expect(orderRuns(runs, order).line).toBeUndefined();
      expect(ids(groupRuns(runs, false, order))).toEqual(['d', 'a', 'c']);
    });

    it('counts only the runs above the line', () => {
      const order = { ids: ['a', 'b', 'c', 'd'], line: 2 };

      expect(orderRuns(runs, order)).toEqual({ runs, line: 2 });
      expect(ids(groupRuns(runs, true, order))).toEqual(['a', 'b']);
      expect(ids(groupRuns(runs, false, order))).toEqual(['a']);
      expect(groupRuns(runs, false, { ...order, line: 0 })).toEqual([]);
    });

    it('puts the runs played since just above the line, counting them as the newest', () => {
      const played = [...runs, log('e', 11), log('f', 12)];
      const order = { ids: ['a', 'b', 'c', 'd'], line: 1 };

      expect(ids(orderRuns(played, order).runs)).toEqual(['a', 'e', 'f', 'b', 'c', 'd']);
      expect(orderRuns(played, order).line).toBe(3);
      expect(ids(groupRuns(played, false, order))).toEqual(['a', 'e', 'f']);
    });

    it('puts the runs played since after all the others when there is no line', () => {
      const played = [...runs, log('e', 11)];

      expect(ids(orderRuns(played, { ids: ['d', 'c', 'b', 'a'] }).runs)).toEqual([
        'd',
        'c',
        'b',
        'a',
        'e',
      ]);
    });

    it('moves a run to another place among the runs', () => {
      const order = { ids: ['a', 'b', 'c', 'd'] };

      expect(moveRun(order, 0, 2)).toEqual({ ids: ['b', 'c', 'a', 'd'] });
      expect(moveRun(order, 3, 0)).toEqual({ ids: ['d', 'a', 'b', 'c'] });
      expect(moveRun(order, 1, 1)).toEqual(order);
    });

    it('moves a run across the line, to be counted or not', () => {
      // a b | c d
      const order = { ids: ['a', 'b', 'c', 'd'], line: 2 };

      expect(moveRun(order, 0, 2)).toEqual({ ids: ['b', 'a', 'c', 'd'], line: 1 });
      expect(moveRun(order, 4, 0)).toEqual({ ids: ['d', 'a', 'b', 'c'], line: 3 });
      expect(moveRun(order, 3, 2)).toEqual({ ids: ['a', 'b', 'c', 'd'], line: 3 });
      expect(moveRun(order, 1, 2)).toEqual({ ids: ['a', 'b', 'c', 'd'], line: 1 });
    });

    it('leaves out the runs deleted since', () => {
      const order = orderRuns(runs.slice(1), { ids: ['a', 'b', 'c', 'd'], line: 2 });

      expect(ids(order.runs)).toEqual(['b', 'c', 'd']);
      expect(order.line).toBe(1);
    });
  });
});
