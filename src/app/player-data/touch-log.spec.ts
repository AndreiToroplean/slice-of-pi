import { addTouch, newTouchLog, parseTouchLog, TOUCH_LOG_FORMAT, TouchLog } from './touch-log';

describe('touch log', () => {
  const empty = newTouchLog('run-1', 1_760_000_000_000);
  const log = [
    { key: '1', x: -0.8, y: 1.2 },
    { key: null, x: 2.5, y: -1 },
    { key: '4' },
    { key: 'backspace', x: 1.1, y: 2 },
  ].reduce(
    (touched, touch, i) => addTouch(touched, touch as Parameters<typeof addTouch>[1], i * 200),
    empty,
  );

  it('starts with no touches', () => {
    expect(empty).toEqual({
      format: TOUCH_LOG_FORMAT,
      id: 'run-1',
      checked: true,
      keypadLayout: 'calculator',
      startedAt: 1_760_000_000_000,
      touches: [],
    });
  });

  it('starts unchecked, or on another keypad layout, when asked', () => {
    expect(newTouchLog('run-1', 0, false).checked).toBe(false);
    expect(newTouchLog('run-1', 0, true, 'telephone').keypadLayout).toBe('telephone');
  });

  it('records each touch, in whole milliseconds, where it was to a thousandth of a step', () => {
    const touched = addTouch(empty, { key: '1', x: 0.12345, y: -1.98765 }, 212.6);

    expect(touched.touches).toEqual([{ key: '1', x: 0.123, y: -1.988, time: 213 }]);
  });

  it('records a key typed without touching the keypad with no place on it', () => {
    expect(addTouch(empty, { key: '3' }, 0).touches).toEqual([{ key: '3', time: 0 }]);
  });

  it('leaves the touch log it adds to unchanged', () => {
    addTouch(empty, { key: '1' }, 0);

    expect(empty.touches).toEqual([]);
  });

  describe('parseTouchLog', () => {
    it('reads a valid touch log', () => {
      expect(parseTouchLog(JSON.parse(JSON.stringify(log)))).toEqual(log);
    });

    it('keeps only the fields of a touch log and of its touches', () => {
      const extra = {
        ...log,
        extra: true,
        touches: log.touches.map((touch) => ({ ...touch, extra: 1 })),
      };

      expect(parseTouchLog(extra)).toEqual(log);
    });

    it('migrates a touch log of format 4, placing touches where they were released, to one without places', () => {
      const older = {
        ...log,
        format: 4,
        touches: [
          { key: '1', x: -1, y: 1, time: 0 },
          { key: null, x: 0.4, y: 0.6, time: 120 },
          { key: '4', time: 212 },
        ],
      };

      expect(parseTouchLog(older)?.touches).toEqual([
        { key: '1', time: 0 },
        { key: '4', time: 212 },
      ]);
    });

    describe('runs from before touch logs', () => {
      const run = {
        format: 3,
        id: 'run-1',
        checked: true,
        keypadLayout: 'telephone',
        startedAt: 1_760_000_000_000,
        digits: '141',
        times: [0, 212, 531],
        backspaces: [3],
      };
      const migrated = {
        format: TOUCH_LOG_FORMAT,
        id: 'run-1',
        checked: true,
        keypadLayout: 'telephone',
        startedAt: 1_760_000_000_000,
        touches: [
          { key: '1', time: 0 },
          { key: '4', time: 212 },
          { key: '1', time: 531 },
        ],
      };

      it('migrates a run of format 3, each digit a key typed with no place, leaving out its backspaces', () => {
        expect(parseTouchLog(run)).toEqual(migrated);
      });

      it('migrates a run of format 2, from before players picked the keypad layout, to one on the calculator layout', () => {
        const { id, checked, startedAt, digits, times, backspaces } = run;
        const older = { format: 2, id, checked, startedAt, digits, times, backspaces };

        expect(parseTouchLog(older)).toEqual({ ...migrated, keypadLayout: 'calculator' });
      });

      it('migrates a run of format 1, from before the game checked digits, to an unchecked run', () => {
        const { id, startedAt, digits, times, backspaces } = run;
        const older = { format: 1, id, startedAt, digits, times, backspaces };

        expect(parseTouchLog(older)).toEqual({
          ...migrated,
          checked: false,
          keypadLayout: 'calculator',
        });
      });

      it('migrates a run without a format as one of format 1', () => {
        const { id, startedAt, digits, times, backspaces } = run;
        const older = { id, startedAt, digits, times, backspaces };

        expect(parseTouchLog(older)).toMatchObject({ format: TOUCH_LOG_FORMAT, checked: false });
      });

      it.each([
        ['a character that is not a digit', { ...run, digits: '1<1' }],
        ['fewer times than digits', { ...run, times: [0, 212] }],
        ['times going back', { ...run, times: [0, 531, 212] }],
      ])('rejects a run with %s', (_, value) => {
        expect(parseTouchLog(value)).toBeUndefined();
      });
    });

    const touches = (...changed: unknown[]): TouchLog => ({ ...log, touches: changed }) as TouchLog;

    it.each([
      ['not an object', 'run'],
      ['null', null],
      ['an unknown format', { ...log, format: TOUCH_LOG_FORMAT + 1 }],
      ['an empty id', { ...log, id: '' }],
      ['a numeric id', { ...log, id: 1 }],
      ['a checked flag that is not a boolean', { ...log, checked: 'yes' }],
      ['an unknown keypad layout', { ...log, keypadLayout: 'typewriter' }],
      ['a negative start', { ...log, startedAt: -1 }],
      ['touches that are not an array', { ...log, touches: 'none' }],
      ['a touch that is not an object', touches('1')],
      ['an unknown key', touches({ key: '<', time: 0 })],
      ['a negative time', touches({ key: '1', time: -5 })],
      ['times going back', touches({ key: '1', time: 200 }, { key: '4', time: 100 })],
      ['a touch with one coordinate', touches({ key: '1', x: 0, time: 0 })],
      ['an infinite coordinate', touches({ key: '1', x: Infinity, y: 0, time: 0 })],
      ['a miss with no place', touches({ key: null, time: 0 })],
    ])('rejects %s', (_, value) => {
      expect(parseTouchLog(value)).toBeUndefined();
    });
  });
});
