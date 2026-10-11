import { isPiDecimal, KNOWN_DECIMALS } from './pi';

describe('isPiDecimal', () => {
  it('tells the decimal of π at each place, place 1 first', () => {
    expect(isPiDecimal(1, '1')).toBe(true);
    expect(isPiDecimal(2, '4')).toBe(true);
    expect(isPiDecimal(2, '1')).toBe(false);
    expect(isPiDecimal(KNOWN_DECIMALS, '6')).toBe(true);
  });

  it('takes no digit past the decimals it knows', () => {
    for (const digit of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const) {
      expect(isPiDecimal(KNOWN_DECIMALS + 1, digit)).toBe(false);
    }
  });
});
