import { DIGITS, isDigit } from '../digit';
import { keyColors, occurrenceColor, PALETTE, placeColors } from './place-colors';

/** The first 50 decimals of π. */
const DECIMALS = '14159265358979323846264338327950288419716939937510';

describe('occurrenceColor', () => {
  it('starts key d on palette color d', () => {
    expect(DIGITS.map((digit) => occurrenceColor(digit, 0))).toEqual(PALETTE);
  });

  it('moves on to the next palette color with each occurrence, starting over at the end', () => {
    expect([0, 1, 2, 3, 10, 11].map((before) => occurrenceColor('7', before))).toEqual([
      PALETTE[7],
      PALETTE[8],
      PALETTE[9],
      PALETTE[0],
      PALETTE[7],
      PALETTE[8],
    ]);
  });

  it('rejects anything but a number of occurrences', () => {
    expect(() => occurrenceColor('7', -1)).toThrow('Not a number of occurrences: -1');
    expect(() => occurrenceColor('7', 0.5)).toThrow('Not a number of occurrences: 0.5');
  });
});

describe('placeColors', () => {
  it('has no colors before any decimal is typed: the leading 3 uses up none', () => {
    expect(placeColors('')).toEqual([]);
  });

  it("gives each place its digit's color after the times it came up before", () => {
    // 1 4 1 5 9 2 6 5 3 5: the second 1 and the second and third 5 move on.
    expect(placeColors('1415926535')).toEqual([
      PALETTE[1],
      PALETTE[4],
      PALETTE[2],
      PALETTE[5],
      PALETTE[9],
      PALETTE[2],
      PALETTE[6],
      PALETTE[6],
      PALETTE[3],
      PALETTE[7],
    ]);
  });

  it("doesn't change the colors of earlier places as more are typed", () => {
    const colors = placeColors(DECIMALS);

    for (let length = 0; length <= DECIMALS.length; length++) {
      expect(placeColors(DECIMALS.slice(0, length))).toEqual(colors.slice(0, length));
    }
  });

  it('rejects anything but digits', () => {
    expect(() => placeColors('14.1')).toThrow('Not a digit: .');
  });
});

describe('keyColors', () => {
  it('starts with the whole palette on the keys, key d on color d', () => {
    expect(DIGITS.map((digit) => keyColors('')[digit])).toEqual(PALETTE);
  });

  it('shows on each key the color its digit takes when typed next', () => {
    for (let length = 0; length < DECIMALS.length; length++) {
      const typed = DECIMALS.slice(0, length);
      const next = DECIMALS.charAt(length);
      if (!isDigit(next)) {
        throw new Error('Not a decimal');
      }

      expect(keyColors(typed)[next]).toBe(placeColors(typed + next).at(-1));
    }
  });

  it('only moves on the key of the digit typed', () => {
    const before = keyColors('1415');
    const after = keyColors('14159');

    expect(DIGITS.filter((digit) => before[digit] !== after[digit])).toEqual(['9']);
  });

  it('rejects anything but digits', () => {
    expect(() => keyColors('1x')).toThrow('Not a digit: x');
  });
});
