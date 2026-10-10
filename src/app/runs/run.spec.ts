import { Digit } from '../digit';
import { addDigit, newRun, parseRun, removeDigit, Run, RUN_FORMAT } from './run';

describe('run', () => {
  const empty = newRun('run-1', 1_760_000_000_000);

  function play(...digits: [Digit, number][]): Run {
    return digits.reduce((run, [digit, time]) => addDigit(run, digit, time), empty);
  }

  it('starts with no digits', () => {
    expect(empty).toEqual({
      format: RUN_FORMAT,
      id: 'run-1',
      startedAt: 1_760_000_000_000,
      digits: '',
      times: [],
      backspaces: [],
    });
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

  describe('parseRun', () => {
    const run = removeDigit(play(['1', 0], ['4', 212], ['1', 531], ['9', 700]));

    it('reads a valid run', () => {
      expect(parseRun(JSON.parse(JSON.stringify(run)))).toEqual(run);
    });

    it('keeps only the fields of a run', () => {
      expect(parseRun({ ...run, extra: true })).toEqual(run);
    });

    it.each([
      ['not an object', 'run'],
      ['null', null],
      ['an unknown format', { ...run, format: RUN_FORMAT + 1 }],
      ['no format', { ...run, format: undefined }],
      ['an empty id', { ...run, id: '' }],
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
