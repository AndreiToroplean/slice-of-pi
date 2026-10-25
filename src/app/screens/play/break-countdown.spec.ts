import { seconds } from './break-countdown';

describe('BreakCountdown', () => {
  it('shows the seconds left to the tenth', () => {
    expect(seconds(5321)).toBe('5.3');
    expect(seconds(40)).toBe('0.0');
    expect(seconds(999_940)).toBe('999.9');
  });

  it('shows a long wait as a power of ten', () => {
    expect(seconds(999_960)).toBe('1.0·10³');
    expect(seconds(3_400_000_000)).toBe('3.4·10⁶');
    expect(seconds(99_990_000)).toBe('1.0·10⁵');
  });
});
