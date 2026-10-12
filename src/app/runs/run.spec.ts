import { Digit } from '../digit';
import {
  addDigit,
  countsInGroups,
  groupRuns,
  playOrder,
  deleteMistake,
  isOlderFormat,
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

  describe('playing from a line among the runs', () => {
    const runs = [newRun('a', 0), newRun('b', 1, false), newRun('c', 2), newRun('d', 3)];
    const ids = (some: readonly Run[]): string[] => some.map((run) => run.id);

    it('keeps the runs in order, all before the line, when not playing from one', () => {
      expect(playOrder(runs, undefined)).toEqual({ runs, before: 4 });
      expect(ids(groupRuns(runs, false, undefined))).toEqual(['a', 'c', 'd']);
      expect(ids(groupRuns(runs, true, undefined))).toEqual(['a', 'b', 'c', 'd']);
    });

    it('counts only the runs before the line', () => {
      expect(playOrder(runs, { at: 2, since: 10 })).toEqual({ runs, before: 2 });
      expect(ids(groupRuns(runs, true, { at: 2, since: 10 }))).toEqual(['a', 'b']);
      expect(ids(groupRuns(runs, false, { at: 2, since: 10 }))).toEqual(['a']);
      expect(groupRuns(runs, false, { at: 0, since: 10 })).toEqual([]);
    });

    it('puts the runs played since just before the line, counting them as the newest', () => {
      const played = [...runs, newRun('e', 11), newRun('f', 12)];

      const order = playOrder(played, { at: 1, since: 10 });

      expect(ids(order.runs)).toEqual(['a', 'e', 'f', 'b', 'c', 'd']);
      expect(order.before).toBe(3);
      expect(ids(groupRuns(played, false, { at: 1, since: 10 }))).toEqual(['a', 'e', 'f']);
    });

    it('draws the line after all the runs there are, if fewer are left', () => {
      expect(playOrder(runs, { at: 9, since: 10 }).before).toBe(4);
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

    it('tells the records in older formats, to be migrated', () => {
      expect(isOlderFormat({ ...run, format: 1 })).toBe(true);
      expect(isOlderFormat(run)).toBe(false);
      expect(isOlderFormat({ ...run, format: RUN_FORMAT + 1 })).toBe(false);
      expect(isOlderFormat({ ...run, format: '1' })).toBe(false);
      expect(isOlderFormat(null)).toBe(false);
    });

    it.each([
      ['not an object', 'run'],
      ['null', null],
      ['an unknown format', { ...run, format: RUN_FORMAT + 1 }],
      ['no format', { ...run, format: undefined }],
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
