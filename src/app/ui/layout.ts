/**
 * Where the play screen's parts sit, sized with the screen: up and down, in hundredths of the screen's height between
 * the status bar and the navigation bar, and across, in hundredths of the column's width. The space around them, such
 * as the screen's margins and the buttons in its corners, keeps its own size instead. The header sits at the top, the
 * slots above the keypad, and the keypad on the bottom margin; each is centered across, and the keypad is no wider
 * than the side margins leave room for.
 */
export interface Layout {
  /** Where the season header's top is, down from the top, and its height, which its text scales with. */
  readonly header: { readonly top: number; readonly height: number };
  /** Where the slots' bottom is, up from the bottom, and a slot's height; a row of 10 is as wide as the keypad. */
  readonly slots: { readonly bottom: number; readonly height: number };
  /** The keypad's height, and its width, across. */
  readonly keypad: { readonly height: number; readonly width: number };
}

/** The game's own layout. */
export const LAYOUT: Layout = {
  header: { top: 0, height: 10 },
  slots: { bottom: 37.4, height: 6 },
  keypad: { height: 32.4, width: 100 },
};

/** A length of so many hundredths of the screen's height, in CSS (see `--unit` in `play.css`). */
function down(value: number): string {
  return `calc(${String(value)} * var(--unit))`;
}

/**
 * The layout as the CSS lengths the play screen lays out with: `--header-top`, `--header-height`, `--slots-bottom`,
 * `--slots-height`, `--keypad-height` and `--keypad-width`, the last as wide as the side margins leave room for at most.
 */
export function layoutStyles(layout: Layout): Readonly<Record<string, string>> {
  const { header, slots, keypad } = layout;
  return {
    '--header-top': down(header.top),
    '--header-height': down(header.height),
    '--slots-bottom': down(slots.bottom),
    '--slots-height': down(slots.height),
    '--keypad-height': down(keypad.height),
    '--keypad-width': `min(${String(keypad.width)} * var(--column) / 100, var(--column) - 2 * var(--space-3))`,
  };
}

/** A layout read from untrusted data, or `undefined` if any of its values is missing or off the screen. */
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
