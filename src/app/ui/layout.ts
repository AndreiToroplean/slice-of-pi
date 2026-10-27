/**
 * Where things sit on the screens. The margins around every page and screen, which nothing is ever in, and the buttons
 * in the screens' corners, snug against them, keep their own size, in rem. The play screen's parts are sized with the
 * screen instead: up and down, in hundredths of its height between the status bar and the navigation bar, measured up
 * from its bottom, and across, in hundredths of the column's width. The season header hangs from the top margin, and the
 * keypad stands on the bottom margin, spanning the column between the side margins; the header and the slots are
 * centered across, and the tape spans the column.
 */
export interface Layout {
  /** The margins around every page and screen, in rem. */
  readonly margins: { readonly top: number; readonly side: number; readonly bottom: number };
  /** The size of the buttons in the screens' corners, in rem. */
  readonly corner: { readonly size: number };
  /** The season header's height, which everything in it scales with. */
  readonly header: { readonly size: number };
  /** Where the tape's top and bottom are, and the height of its tiles, which have a slot's proportions. */
  readonly tape: { readonly top: number; readonly bottom: number; readonly words: number };
  /** Where the slots' top and bottom are, and a slot's width, across: the gaps make a row of 10 as wide as the keypad. */
  readonly slots: { readonly top: number; readonly bottom: number; readonly width: number };
  /** Where the keypad's top is. */
  readonly keypad: { readonly top: number };
}

/** The game's own layout. */
export const LAYOUT: Layout = {
  margins: { top: 0.625, side: 1.125, bottom: 1.125 },
  corner: { size: 2.75 },
  header: { size: 10 },
  tape: { top: 49, bottom: 44, words: 3.2 },
  slots: { top: 43.4, bottom: 37.4, width: 8.1 },
  keypad: { top: 35 },
};

/** A length of so many hundredths of the screen's height, in CSS (see `--unit` in `play.css`). */
function down(value: number): string {
  return `calc(${String(value)} * var(--unit))`;
}

/** A length of so many rem, in CSS. */
function rem(value: number): string {
  return `${String(value)}rem`;
}

/** A length of so many hundredths of the column's width, in CSS. */
function across(value: number): string {
  return `calc(${String(value)} * var(--column) / 100)`;
}

/**
 * The layout as the CSS lengths the screens lay out with: `--margin-top`, `--margin-side`, `--margin-bottom` and
 * `--corner-size` on every screen; on the play screen, `--header-height`, `--tape-top`, `--tape-bottom`, `--tile-height`,
 * `--tile-width`, `--slots-top`, `--slots-bottom`, `--slot-width` and `--keypad-top`.
 */
export function layoutStyles(layout: Layout): Readonly<Record<string, string>> {
  const { margins, corner, header, tape, slots, keypad } = layout;
  return {
    '--margin-top': rem(margins.top),
    '--margin-side': rem(margins.side),
    '--margin-bottom': rem(margins.bottom),
    '--corner-size': rem(corner.size),
    '--header-height': down(header.size),
    '--tape-top': down(tape.top),
    '--tape-bottom': down(tape.bottom),
    '--tile-height': down(tape.words),
    '--tile-width': across((slots.width * tape.words) / Math.max(slots.top - slots.bottom, 0.1)),
    '--slots-top': down(slots.top),
    '--slots-bottom': down(slots.bottom),
    '--slot-width': across(slots.width),
    '--keypad-top': down(keypad.top),
  };
}

/** A layout read from untrusted data, or `undefined` if any of its values is missing or out of range. */
export function parseLayout(value: unknown): Layout | undefined {
  return shaped(LAYOUT, value);
}

/** What of `value` has the shape of `shape`, each number from 0 to 100, or `undefined` if any is missing. */
function shaped<T extends object>(shape: T, value: unknown): T | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const entries = Object.entries(shape).map(([key, part]): [string, unknown] => {
    const stored = (value as Record<string, unknown>)[key];
    if (typeof part === 'object' && part !== null) {
      return [key, shaped(part, stored)];
    }
    return [key, typeof stored === 'number' && stored >= 0 && stored <= 100 ? stored : undefined];
  });
  return entries.every(([, part]) => part !== undefined)
    ? (Object.fromEntries(entries) as T)
    : undefined;
}
