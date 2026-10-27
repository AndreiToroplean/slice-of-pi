/**
 * Where things sit on the screens. The margins around every page and screen, which nothing is ever in, and the buttons
 * in the screens' corners, snug against them, keep their own size, in rem. The play screen's parts are sized with the
 * screen instead: up and down, in hundredths of its height between the status bar and the navigation bar, measured up
 * from its bottom, and across, in hundredths of the column's width. The season header hangs from the top margin, and the
 * keypad stands on the bottom margin, spanning the column between the side margins; the header and the slots are
 * centered across, and the tape spans the column. The gaps between the keys, as between the slots, are what their
 * sizes leave.
 */
export interface Layout {
  /** The margins around every page and screen, in rem. */
  readonly margins: { readonly top: number; readonly side: number; readonly bottom: number };
  /** The size of the buttons in the screens' corners, and their rounding, in rem. */
  readonly corner: { readonly size: number; readonly radius: number };
  /** The season header's height, which everything in it scales with. */
  readonly header: { readonly size: number };
  /** Where the tape's top and bottom are, and the height of its tiles, which have a slot's proportions. */
  readonly tape: { readonly top: number; readonly bottom: number; readonly words: number };
  /**
   * Where the slots' top and bottom are, a slot's width, across, and its rounding, which the tape's tiles share, scaled
   * with them. The gaps make a row of 10 as wide as the keypad.
   */
  readonly slots: {
    readonly top: number;
    readonly bottom: number;
    readonly width: number;
    readonly radius: number;
  };
  /**
   * Where the keypad's top is, how far above it the touches of the keys on top reach, and the keys' size, across and up
   * and down, and their rounding.
   */
  readonly keypad: {
    readonly top: number;
    readonly reach: number;
    readonly keyWidth: number;
    readonly keyHeight: number;
    readonly keyRadius: number;
  };
}

/** The game's own layout. */
export const LAYOUT: Layout = {
  margins: { top: 0.625, side: 1.125, bottom: 1.125 },
  corner: { size: 2.75, radius: 0.875 },
  header: { size: 10 },
  tape: { top: 49, bottom: 44, words: 3.2 },
  slots: { top: 43.4, bottom: 37.4, width: 8.1, radius: 1.1 },
  keypad: { top: 35, reach: 2.5, keyWidth: 28.6, keyHeight: 7.4, keyRadius: 2.4 },
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
 * The layout as the CSS lengths the screens lay out with: `--margin-top`, `--margin-side`, `--margin-bottom`,
 * `--corner-size` and `--corner-radius` on every screen; on the play screen, `--header-height`, `--tape-top`,
 * `--tape-bottom`, `--tile-height`, `--tile-width`, `--tile-radius`, `--slots-top`, `--slots-bottom`, `--slot-width`,
 * `--slot-radius`, `--keypad-top`, `--keypad-reach`, `--keypad-key-width`, `--keypad-key-height` and
 * `--keypad-key-radius`.
 */
export function layoutStyles(layout: Layout): Readonly<Record<string, string>> {
  const { margins, corner, header, tape, slots, keypad } = layout;
  // How much smaller than a slot a tile is.
  const tileScale = tape.words / Math.max(slots.top - slots.bottom, 0.1);
  return {
    '--margin-top': rem(margins.top),
    '--margin-side': rem(margins.side),
    '--margin-bottom': rem(margins.bottom),
    '--corner-size': rem(corner.size),
    '--corner-radius': rem(corner.radius),
    '--header-height': down(header.size),
    '--tape-top': down(tape.top),
    '--tape-bottom': down(tape.bottom),
    '--tile-height': down(tape.words),
    '--tile-width': across(slots.width * tileScale),
    '--tile-radius': down(slots.radius * tileScale),
    '--slots-top': down(slots.top),
    '--slots-bottom': down(slots.bottom),
    '--slot-width': across(slots.width),
    '--slot-radius': down(slots.radius),
    '--keypad-top': down(keypad.top),
    '--keypad-reach': down(keypad.reach),
    '--keypad-key-width': across(keypad.keyWidth),
    '--keypad-key-height': down(keypad.keyHeight),
    '--keypad-key-radius': down(keypad.keyRadius),
  };
}

/**
 * A layout read from untrusted data, or `undefined` if it isn't one. Each value missing or out of range takes the
 * game's own, so that adding or dropping one keeps the others.
 */
export function parseLayout(value: unknown): Layout | undefined {
  return typeof value === 'object' && value !== null ? shaped(LAYOUT, value) : undefined;
}

/** `value` in the shape of `shape`, each number from 0 to 100, or else the one in `shape`. */
function shaped<T extends object>(shape: T, value: unknown): T {
  const stored =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(shape).map(([key, part]): [string, unknown] => {
      const each = stored[key];
      if (typeof part === 'object' && part !== null) {
        return [key, shaped(part, each)];
      }
      return [key, typeof each === 'number' && each >= 0 && each <= 100 ? each : part];
    }),
  ) as T;
}
