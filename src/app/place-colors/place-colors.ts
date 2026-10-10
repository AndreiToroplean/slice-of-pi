import { Digit, DIGITS, isDigit } from '../digit';

/**
 * The palette (`colors.md` §2): 10 solid colors around the color wheel, chosen to carry white digits and to look
 * distinct next to one another. Every key steps through it in this order. Players learn with these colors, so they're
 * frozen: golden tests pin them.
 */
export const PALETTE = [
  '#e3402f', // red
  '#fd7225', // orange
  '#f4ba0d', // yellow
  '#a9c926', // lime
  '#3cba60', // green
  '#07bed4', // teal
  '#3371fa', // blue
  '#8225d7', // violet
  '#bf56c1', // purple
  '#ff82d1', // pink
] as const;

/** A palette: {@link PALETTE}, or one tuned in developer mode, with as many colors. */
export type Palette = readonly string[];

/**
 * The color of an occurrence of `digit`, given how many times the digit came up before it: key d starts on palette
 * color d, so the keys start on 10 different colors, and each occurrence moves its key on to the next color.
 */
export function occurrenceColor(digit: Digit, before: number, palette: Palette = PALETTE): string {
  const color =
    Number.isInteger(before) && before >= 0
      ? palette[(Number(digit) + before) % palette.length]
      : undefined;
  if (color === undefined) {
    throw new Error(`Not a number of occurrences: ${String(before)}`);
  }
  return color;
}

/**
 * The colors of the typed places: the color of place p is at index p - 1. Only the decimals count, so the leading 3
 * uses up no color. The game doesn't check digits against π yet, so a place's color comes from how many times its
 * digit was typed before it, which matches π whenever the player types correctly (`colors.md` §5).
 */
export function placeColors(digits: string, palette: Palette = PALETTE): readonly string[] {
  const seen = occurrenceCounts();
  return Array.from(digits, (digit) => {
    const d = asDigit(digit);
    return occurrenceColor(d, seen[d]++, palette);
  });
}

/** Each key's color after the typed digits: the color its digit will take the next time it's typed. */
export function keyColors(
  digits: string,
  palette: Palette = PALETTE,
): Readonly<Record<Digit, string>> {
  const seen = occurrenceCounts();
  for (const digit of digits) {
    seen[asDigit(digit)]++;
  }
  return Object.fromEntries(
    DIGITS.map((digit) => [digit, occurrenceColor(digit, seen[digit], palette)]),
  ) as Record<Digit, string>;
}

function occurrenceCounts(): Record<Digit, number> {
  return Object.fromEntries(DIGITS.map((digit) => [digit, 0])) as Record<Digit, number>;
}

function asDigit(value: string): Digit {
  if (!isDigit(value)) {
    throw new Error(`Not a digit: ${value}`);
  }
  return value;
}
