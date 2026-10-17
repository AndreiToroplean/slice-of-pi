import { Digit } from '../digit';
import {
  addDigit,
  countsInGroups,
  groupRuns,
  moveRun,
  orderRuns,
  deleteMistake,
  newRun,
  parseRun,
  removeDigit,
  Run,
  RUN_FORMAT,
} from './run';

describe('run', () => {
  const empty = newRun('run-1', 1_760_000_000_000);

  function play(...digits: [Digit, number][]): Run {
    return digits.reduce((run, [digit, time]) => addDigit(run, digit, time), empty);
  }

  it('starts with no digits', () => {
    expect(empty).toEqual({
      format: RUN_FORMAT,
      id: 'run-1',
      checked: true,
      startedAt: 1_760_000_000_000,
      digits: '',
      times: [],
      backspaces: [],
    });
  });

  it('starts unchecked when asked', () => {
    expect(newRun('run-1', 0, false).checked).toBe(false);
  });

  it('records every digit and when it was typed, in whole milliseconds', () => {
    const run = play(['1', 0], ['4', 212.4], ['1', 530.6]);

    expect(run.digits).toBe('141');
    expect(run.times).toEqual([0, 212, 531]);
  });

  it('removes the last digit and its time, and records the place of the backspace apart', () => {
    const run = removeDigit(play(['1', 0], ['5', 212]));

    expect(run.digits).toBe('1');
    expect(run.times).toEqual([0]);
    expect(run.backspaces).toEqual([2]);
  });

  it('records every backspace, even several at one place', () => {
    let run = play(['1', 0], ['4', 200], ['5', 400]);
    run = removeDigit(run);
    run = addDigit(run, '7', 500);
    run = removeDigit(run);
    run = removeDigit(run);

    expect(run.digits).toBe('1');
    expect(run.backspaces).toEqual([3, 3, 2]);
  });

  it('records the backspace deleting a wrong digit after the last one, which it never kept', () => {
    const run = deleteMistake(play(['1', 0], ['4', 212]), 3);

    expect(run.digits).toBe('14');
    expect(run.times).toEqual([0, 212]);
    expect(run.backspaces).toEqual([3]);
  });

  it('records no backspace when there is no digit to delete', () => {
    expect(removeDigit(empty)).toBe(empty);
  });

  it('leaves the run it changes unchanged', () => {
    const run = play(['1', 0]);
    addDigit(run, '4', 200);
    removeDigit(run);

    expect(run.digits).toBe('1');
    expect(run.times).toEqual([0]);
  });

  it('computes the groups from the checked runs, unless the unchecked ones are included', () => {
    const checked = newRun('checked', 0);
    const unchecked = newRun('unchecked', 1, false);

    expect(countsInGroups(checked, false)).toBe(true);
    expect(countsInGroups(unchecked, false)).toBe(false);
    expect(countsInGroups(unchecked, true)).toBe(true);
  });

  describe('the order of the runs', () => {
    const runs = [newRun('a', 0), newRun('b', 1, false), newRun('c', 2), newRun('d', 3)];
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
      const played = [...runs, newRun('e', 11), newRun('f', 12)];
      const order = { ids: ['a', 'b', 'c', 'd'], line: 1 };

      expect(ids(orderRuns(played, order).runs)).toEqual(['a', 'e', 'f', 'b', 'c', 'd']);
      expect(orderRuns(played, order).line).toBe(3);
      expect(ids(groupRuns(played, false, order))).toEqual(['a', 'e', 'f']);
    });

    it('puts the runs played since after all the others when there is no line', () => {
      const played = [...runs, newRun('e', 11)];

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

  describe('parseRun', () => {
    const run = removeDigit(play(['1', 0], ['4', 212], ['1', 531], ['9', 700]));

    it('reads a valid run', () => {
      expect(parseRun(JSON.parse(JSON.stringify(run)))).toEqual(run);
    });

    it('keeps only the fields of a run', () => {
      expect(parseRun({ ...run, extra: true })).toEqual(run);
    });

    it('reads an unchecked run', () => {
      expect(parseRun({ ...run, checked: false })).toEqual({ ...run, checked: false });
    });

    it('migrates a run of format 1, from before the game checked digits, to an unchecked run', () => {
      const { id, startedAt, digits, times, backspaces } = run;
      const older = { format: 1, id, startedAt, digits, times, backspaces };

      expect(parseRun(older)).toEqual({ ...run, checked: false });
    });

    it('migrates a run without a format as one of format 1', () => {
      const { id, startedAt, digits, times, backspaces } = run;

      expect(parseRun({ id, startedAt, digits, times, backspaces })).toEqual({
        ...run,
        checked: false,
      });
    });

    it.each([
      ['not an object', 'run'],
      ['null', null],
      ['an unknown format', { ...run, format: RUN_FORMAT + 1 }],
      ['an empty id', { ...run, id: '' }],
      ['no checked flag', { ...run, checked: undefined }],
      ['a checked flag that is not a boolean', { ...run, checked: 'yes' }],
      ['a numeric id', { ...run, id: 1 }],
      ['a negative start', { ...run, startedAt: -1 }],
      ['a start that is not a number', { ...run, startedAt: '2026-10-10' }],
      ['a character that is not a digit', { ...run, digits: '1<1' }],
      ['digits that are not a string', { ...run, digits: ['1', '4', '1'] }],
      ['fewer times than digits', { ...run, times: [0, 212] }],
      ['times that are not an array', { ...run, times: '0,212,531' }],
      ['a time that is not a number', { ...run, times: [0, '212', 531] }],
      ['an infinite time', { ...run, times: [0, 212, Infinity] }],
      ['a negative time', { ...run, times: [-5, 212, 531] }],
      ['times going back', { ...run, times: [0, 531, 212] }],
      ['no backspaces', { ...run, backspaces: undefined }],
      ['a backspace at place 0', { ...run, backspaces: [0] }],
      ['a backspace between places', { ...run, backspaces: [1.5] }],
      ['a backspace that is not a number', { ...run, backspaces: ['4'] }],
    ])('rejects %s', (_, value) => {
      expect(parseRun(value)).toBeUndefined();
    });
  });
});
