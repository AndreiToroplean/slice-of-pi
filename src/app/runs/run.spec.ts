import { addKey, newRun, parseRun, Run, RUN_FORMAT, typedRun } from './run';

describe('run', () => {
  const empty = newRun('run-1', 1_760_000_000_000);

  function play(...presses: [Parameters<typeof addKey>[1], number][]): Run {
    return presses.reduce((run, [key, time]) => addKey(run, key, time), empty);
  }

  it('starts with no keys', () => {
    expect(empty).toEqual({
      format: RUN_FORMAT,
      id: 'run-1',
      startedAt: 1_760_000_000_000,
      keys: '',
      times: [],
    });
  });

  it('records every key and when it was pressed, in whole milliseconds', () => {
    const run = play(['1', 0], ['4', 212.4], ['backspace', 530.6], ['4', 801]);

    expect(run.keys).toBe('14<4');
    expect(run.times).toEqual([0, 212, 531, 801]);
  });

  it('leaves the run it adds to unchanged', () => {
    addKey(empty, '1', 0);

    expect(empty.keys).toBe('');
    expect(empty.times).toEqual([]);
  });

  describe('typedRun', () => {
    it('gives the digits typed and when each was typed', () => {
      expect(typedRun(play(['1', 0], ['4', 200], ['1', 390]))).toEqual({
        digits: '141',
        times: [0, 200, 390],
      });
    });

    it('drops the digits deleted with backspace, with their times', () => {
      expect(
        typedRun(play(['1', 0], ['5', 200], ['backspace', 600], ['4', 900], ['1', 1100])),
      ).toEqual({ digits: '141', times: [0, 900, 1100] });
    });

    it('ignores backspace when nothing is typed', () => {
      expect(typedRun(play(['backspace', 0], ['1', 300]))).toEqual({
        digits: '1',
        times: [300],
      });
    });

    it('gives nothing for a run without keys', () => {
      expect(typedRun(empty)).toEqual({ digits: '', times: [] });
    });
  });

  describe('parseRun', () => {
    const run = play(['1', 0], ['4', 212], ['backspace', 531]);

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
      ['a key that is neither a digit nor backspace', { ...run, keys: '1x<' }],
      ['keys that are not a string', { ...run, keys: ['1', '4', '<'] }],
      ['fewer times than keys', { ...run, times: [0, 212] }],
      ['times that are not an array', { ...run, times: '0,212,531' }],
      ['a time that is not a number', { ...run, times: [0, '212', 531] }],
      ['an infinite time', { ...run, times: [0, 212, Infinity] }],
      ['a negative time', { ...run, times: [-5, 212, 531] }],
      ['times going back', { ...run, times: [0, 531, 212] }],
    ])('rejects %s', (_, value) => {
      expect(parseRun(value)).toBeUndefined();
    });
  });
});
