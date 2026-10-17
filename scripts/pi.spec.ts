import { PI_DECIMALS } from '../src/app/game/pi/pi-decimals';
import { chudnovsky, decimalsModule } from './pi';

/**
 * The first `decimals` decimals of π by another formula than the one they were written with, Machin's: π/4 = 4
 * arctan(1/5) − arctan(1/239), each arctangent summed as its series in integers scaled by 10^(decimals + guard). Much
 * slower: about 15 s for 100,000 decimals.
 */
function machin(decimals: number): string {
  const one = 10n ** BigInt(decimals + 10);
  const pi = 4n * (4n * arccot(5n, one) - arccot(239n, one));
  return pi.toString().slice(1, decimals + 1);
}

/** arctan(1/x), scaled by `one`. */
function arccot(x: bigint, one: bigint): bigint {
  let sum = 0n;
  let power = one / x;
  for (let n = 1n, sign = 1n; power !== 0n; n += 2n, sign = -sign) {
    sum += (sign * power) / n;
    power /= x * x;
  }
  return sum;
}

describe('pi', () => {
  it('computes the decimals of π', () => {
    expect(chudnovsky(30)).toBe('141592653589793238462643383279');
    expect(machin(30)).toBe('141592653589793238462643383279');
  });

  it('writes the decimals in a module', () => {
    expect(decimalsModule('1415')).toContain("export const PI_DECIMALS =\n  '1415';\n");
  });

  // Manual: the stored decimals never change, so these only run with `npm run test:manual`.
  describe('the stored decimals', { tags: ['manual'] }, () => {
    it('are those the Chudnovsky series writes', () => {
      expect(chudnovsky(PI_DECIMALS.length) === PI_DECIMALS).toBe(true);
    });

    it("match Machin's formula, computed independently", { timeout: 120_000 }, () => {
      expect(machin(PI_DECIMALS.length) === PI_DECIMALS).toBe(true);
    });

    it('match published landmarks', () => {
      expect(PI_DECIMALS.slice(0, 50)).toBe('14159265358979323846264338327950288419716939937510');
      // The Feynman point: six 9s in a row from place 762.
      expect(PI_DECIMALS.indexOf('999999')).toBe(761);
    });
  });
});
