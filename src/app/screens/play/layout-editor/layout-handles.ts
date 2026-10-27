import { Layout } from '../../../ui/layout';

/** What a layout value is measured in (see `layout.ts`): rem, hundredths of the screen's height, or of the column's width. */
export type LayoutUnit = 'rem' | 'height' | 'column';

/** How many CSS pixels each unit is, on the screen as laid out now. */
export type UnitSizes = Readonly<Record<LayoutUnit, number>>;

/**
 * A handle of edit mode, on an edge of a part of the play screen: dragging it, up and down or across, changes one value
 * of the layout. Its line lies along that edge, and its knob, which takes the drag, somewhere along the line, apart from
 * the knobs nearby.
 */
export interface LayoutHandle {
  readonly label: string;
  /** Which way it's dragged: `y` up and down, along a line across; `x` across, along an upright line. */
  readonly axis: 'x' | 'y';
  /** Which way dragging it raises its value: `1` down or right, `-1` up or left. */
  readonly sign: 1 | -1;
  readonly unit: LayoutUnit;
  /** How far the handle moves for each unit its value changes. */
  readonly scale: number;
  readonly get: (layout: Layout) => number;
  /**
   * The layout with the value set, kept within what the layout allows: a part's bottom carries its top along, so that
   * the part moves rather than grows.
   */
  readonly set: (layout: Layout, value: number, sizes: UnitSizes) => Layout;
  /** Where its line lies, in CSS, with the layout's lengths (see `layoutStyles`). */
  readonly line: Readonly<Record<string, string>>;
  /** Where its knob sits along the line. */
  readonly knob: Readonly<Record<string, string>>;
}

/** The finest step of each unit: a sixteenth of a rem, a pixel at the browser's default size, and a tenth of the others. */
export const STEPS: Readonly<Record<LayoutUnit, number>> = {
  rem: 0.0625,
  height: 0.1,
  column: 0.1,
};

/** Up from the floor (see `play.css`), as the play screen's parts are laid out. */
const up = (length: string): Readonly<Record<string, string>> => ({
  bottom: `calc(var(--floor) + ${length})`,
});
const across = (left: string): Readonly<Record<string, string>> => ({ left });

const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));

/** A part moved to a new bottom, its top along with it, staying on the screen. */
function moved<T extends { readonly top: number; readonly bottom: number }>(
  part: T,
  to: number,
): T {
  const height = part.top - part.bottom;
  const bottom = clamp(to, 0, 100 - height);
  return { ...part, bottom, top: rounded(bottom + height, 'height') };
}

/** Every handle of edit mode. */
export const LAYOUT_HANDLES: readonly LayoutHandle[] = [
  {
    label: 'Top margin',
    axis: 'y',
    sign: 1,
    unit: 'rem',
    scale: 1,
    get: (layout) => layout.margins.top,
    set: (layout, top) => ({ ...layout, margins: { ...layout.margins, top: clamp(top) } }),
    line: { top: 'var(--margin-top)' },
    knob: across('25%'),
  },
  {
    label: 'Side margins',
    axis: 'x',
    sign: 1,
    unit: 'rem',
    scale: 1,
    get: (layout) => layout.margins.side,
    set: (layout, side) => ({ ...layout, margins: { ...layout.margins, side: clamp(side) } }),
    line: { left: 'calc(var(--margin) + var(--margin-side))', top: '0', bottom: '0' },
    knob: { top: '30%' },
  },
  {
    label: 'Bottom margin',
    axis: 'y',
    sign: -1,
    unit: 'rem',
    scale: 1,
    get: (layout) => layout.margins.bottom,
    // The keypad's top, which is measured from the screen's bottom rather than from the margin.
    set: (layout, value, sizes) => {
      const bottom = clamp(value);
      const shift = ((bottom - layout.margins.bottom) * sizes.rem) / sizes.height;
      return {
        ...layout,
        margins: { ...layout.margins, bottom },
        keypad: { top: clamp(rounded(layout.keypad.top + shift, 'height')) },
      };
    },
    line: up('var(--margin-bottom)'),
    knob: across('50%'),
  },
  {
    label: 'Corners',
    axis: 'y',
    sign: 1,
    unit: 'rem',
    scale: 1,
    get: (layout) => layout.corner.size,
    set: (layout, size) => ({ ...layout, corner: { size: clamp(size, 1) } }),
    line: { top: 'calc(var(--margin-top) + var(--corner-size))' },
    // At the inner corner of the right one: corner buttons keep to the window's corners, not the column's.
    knob: across('calc(100% - var(--margin-side) - var(--corner-size))'),
  },
  {
    label: 'Header',
    axis: 'y',
    sign: 1,
    unit: 'height',
    scale: 1,
    get: (layout) => layout.header.size,
    set: (layout, size) => ({ ...layout, header: { size: clamp(size, 1) } }),
    line: { top: 'calc(var(--margin-top) + var(--header-height))' },
    knob: across('50%'),
  },
  {
    label: 'Tape top',
    axis: 'y',
    sign: -1,
    unit: 'height',
    scale: 1,
    get: (layout) => layout.tape.top,
    set: (layout, top) => ({
      ...layout,
      tape: { ...layout.tape, top: clamp(top, layout.tape.bottom) },
    }),
    line: up('var(--tape-top)'),
    knob: across('20%'),
  },
  {
    label: 'Tiles',
    axis: 'y',
    sign: -1,
    unit: 'height',
    // Their top edge, as they stay across the middle of the tape.
    scale: 0.5,
    get: (layout) => layout.tape.words,
    set: (layout, words) => ({ ...layout, tape: { ...layout.tape, words: clamp(words, 0.5) } }),
    line: up('calc((var(--tape-top) + var(--tape-bottom) + var(--tile-height)) / 2)'),
    knob: across('50%'),
  },
  {
    label: 'Tape bottom',
    axis: 'y',
    sign: -1,
    unit: 'height',
    scale: 1,
    get: (layout) => layout.tape.bottom,
    set: (layout, bottom) => ({ ...layout, tape: moved(layout.tape, bottom) }),
    line: up('var(--tape-bottom)'),
    knob: across('20%'),
  },
  {
    label: 'Slots top',
    axis: 'y',
    sign: -1,
    unit: 'height',
    scale: 1,
    get: (layout) => layout.slots.top,
    set: (layout, top) => ({
      ...layout,
      slots: { ...layout.slots, top: clamp(top, layout.slots.bottom + 0.5) },
    }),
    line: up('var(--slots-top)'),
    knob: across('80%'),
  },
  {
    label: 'Slot width',
    axis: 'x',
    sign: 1,
    unit: 'column',
    scale: 1,
    get: (layout) => layout.slots.width,
    set: (layout, width) => ({ ...layout, slots: { ...layout.slots, width: clamp(width, 1, 10) } }),
    // The first slot's right edge: the row of 10 starts at the keypad's left edge, whatever the slots' width.
    line: {
      left: 'calc(var(--margin) + var(--margin-side) + var(--slot-width))',
      ...up('var(--slots-bottom)'),
      height: 'calc(var(--slots-top) - var(--slots-bottom))',
    },
    knob: { top: '50%' },
  },
  {
    label: 'Slots bottom',
    axis: 'y',
    sign: -1,
    unit: 'height',
    scale: 1,
    get: (layout) => layout.slots.bottom,
    set: (layout, bottom) => ({ ...layout, slots: moved(layout.slots, bottom) }),
    line: up('var(--slots-bottom)'),
    knob: across('80%'),
  },
  {
    label: 'Keypad top',
    axis: 'y',
    sign: -1,
    unit: 'height',
    scale: 1,
    get: (layout) => layout.keypad.top,
    set: (layout, top) => ({ ...layout, keypad: { top: clamp(top, 5) } }),
    line: up('var(--keypad-top)'),
    knob: across('50%'),
  },
];

/** A value rounded to the finest step of its unit, so that the values copied stay short. */
function rounded(value: number, unit: LayoutUnit): number {
  const step = STEPS[unit];
  return Number((Math.round(value / step) * step).toFixed(4));
}

/** The layout once a handle has been dragged `distance` CSS pixels, down or right, from where it was in `layout`. */
export function dragged(
  handle: LayoutHandle,
  layout: Layout,
  distance: number,
  sizes: UnitSizes,
): Layout {
  const change = (handle.sign * distance) / (sizes[handle.unit] * handle.scale);
  return handle.set(layout, rounded(handle.get(layout) + change, handle.unit), sizes);
}

/** The layout once a handle's value has been stepped `steps` times, up or down, as with the arrow keys. */
export function stepped(
  handle: LayoutHandle,
  layout: Layout,
  steps: number,
  sizes: UnitSizes,
): Layout {
  return handle.set(
    layout,
    rounded(handle.get(layout) + steps * STEPS[handle.unit], handle.unit),
    sizes,
  );
}
