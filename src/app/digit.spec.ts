import { DIGITS, isDigit } from './digit';

describe('isDigit', () => {
  it('accepts every decimal digit', () => {
    for (const digit of DIGITS) {
      expect(isDigit(digit)).toBe(true);
    }
  });

  it.each(['', 'a', '.', ' ', '10', '٣', 'Digit3'])('rejects %j', (value) => {
    expect(isDigit(value)).toBe(false);
  });
});
