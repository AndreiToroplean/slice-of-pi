import { appendDigit, EMPTY_TAPE, Tape } from './tape';

describe('appendDigit', () => {
  it('appends the digit at the next position', () => {
    const tape = appendDigit(appendDigit(EMPTY_TAPE, '3', 10), '1', 10);

    expect(tape).toEqual({
      count: 2,
      recent: [
        { position: 0, digit: '3' },
        { position: 1, digit: '1' },
      ],
    });
  });

  it('drops the oldest entries beyond the capacity but keeps counting', () => {
    let tape: Tape = EMPTY_TAPE;
    for (const digit of ['3', '1', '4', '1', '5'] as const) {
      tape = appendDigit(tape, digit, 3);
    }

    expect(tape).toEqual({
      count: 5,
      recent: [
        { position: 2, digit: '4' },
        { position: 3, digit: '1' },
        { position: 4, digit: '5' },
      ],
    });
  });

  it('stays bounded over a long sequence', () => {
    let tape: Tape = EMPTY_TAPE;
    for (let i = 0; i < 10_000; i++) {
      tape = appendDigit(tape, '7', 32);
    }

    expect(tape.count).toBe(10_000);
    expect(tape.recent).toHaveLength(32);
    expect(tape.recent.at(-1)?.position).toBe(9_999);
  });

  it('does not modify the given tape', () => {
    const before = appendDigit(EMPTY_TAPE, '3', 10);
    appendDigit(before, '1', 10);

    expect(before.recent).toHaveLength(1);
    expect(EMPTY_TAPE.recent).toHaveLength(0);
  });
});
