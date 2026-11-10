import { Layout } from '../../../ui/layout';
import { Handle, rounded, STEPS, UnitSizes } from '../../../ui/handles/handle';

/**
 * A handle of edit mode, on an edge of a part of the play screen: dragging it, up and down or across, changes one value
 * of the layout. Its line lies along that edge, with the layout's lengths (see `layoutStyles`), and its knob somewhere
 * along the line, apart from the knobs nearby. Setting a part's bottom carries its top along, so that the part moves
 * rather than grows.
 */
export type LayoutHandle = Handle<Layout>;

/** Up from the floor (see `play.css`), as the play screen's parts are laid out. */
const up = (length: string): Readonly<Record<string, string>> => ({
  bottom: `calc(var(--floor) + ${length})`,
});
const across = (left: string): Readonly<Record<string, string>> => ({ left });
/** A point, as an upright line of no height, for a rounding's handle: where the curve meets the edge it's dragged along. */
const point = (left: string, top: string): Readonly<Record<string, string>> => ({
  left,
  top,
  height: '0',
});

const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));

/*
 * The keys stop where they'd overlap: as the keypad shrinks, or as they grow. Such a limit only stops a drag, never
 * moves a value already past it, as in a layout tuned on a larger screen.
 */

/** The bottom margin, in hundredths of the screen's height: the keypad's rows stand on it. */
const bottomMargin = (layout: Layout, sizes: UnitSizes): number =>
  (layout.margins.bottom * sizes.rem) / sizes.height;

/** A part moved to a new bottom, its top along with it, staying on the screen. */
function moved<T extends { readonly top: number; readonly bottom: number }>(
  part: T,
  to: number,
): T {
  const height = part.top - part.bottom;
  const bottom = clamp(to, 0, 100 - height);
  return { ...part, bottom, top: rounded(bottom + height, STEPS.height) };
}

/** Every handle of edit mode, from the top of the screen down. */
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
    label: 'Corner size',
    axis: 'y',
    sign: 1,
    unit: 'rem',
    scale: 1,
    get: (layout) => layout.corner.size,
    set: (layout, value) => {
      const size = clamp(value, 1);
      return { ...layout, corner: { size, radius: Math.min(layout.corner.radius, size / 2) } };
    },
    line: { top: 'calc(var(--margin-top) + var(--corner-size))' },
    // At the inner corner of the right one: corner buttons keep to the window's corners, not the column's.
    knob: across('calc(100% - var(--margin-side) - var(--corner-size))'),
  },
  {
    label: 'Corner radius',
    axis: 'x',
    sign: 1,
    unit: 'rem',
    scale: 1,
    get: (layout) => layout.corner.radius,
    set: (layout, radius) => ({
      ...layout,
      corner: { ...layout.corner, radius: clamp(radius, 0, layout.corner.size / 2) },
    }),
    // Where the rounding of the right one's top left corner meets its top, the knob on its left, within the screen.
    line: point(
      'calc(100% - var(--margin-side) - var(--corner-size) + var(--corner-radius))',
      'var(--margin-top)',
    ),
    knob: { top: '0', translate: 'calc(-100% - 0.25rem) -50%' },
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
    knob: across('40%'),
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
    knob: across('70%'),
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
    knob: across('40%'),
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
    knob: across('85%'),
  },
  {
    label: 'Slot radius',
    axis: 'x',
    sign: 1,
    unit: 'height',
    scale: 1,
    get: (layout) => layout.slots.radius,
    set: (layout, radius) => ({
      ...layout,
      slots: {
        ...layout.slots,
        radius: clamp(radius, 0, (layout.slots.top - layout.slots.bottom) / 2),
      },
    }),
    // Where the rounding of the first slot's top left corner meets its top.
    line: point(
      'calc(var(--margin) + var(--margin-side) + var(--slot-radius))',
      'calc(100% - var(--floor) - var(--slots-top))',
    ),
    knob: { top: '0' },
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
    knob: across('85%'),
  },
  {
    label: 'Slot depth',
    axis: 'y',
    sign: -1,
    unit: 'height',
    scale: 1,
    get: (layout) => layout.slots.depth,
    set: (layout, depth) => ({
      ...layout,
      slots: {
        ...layout.slots,
        depth: clamp(depth, 0, (layout.slots.top - layout.slots.bottom) / 2),
      },
    }),
    // The bottom of a filled slot's face, above its thickness.
    line: up('calc(var(--slots-bottom) + var(--slot-depth))'),
    knob: across('60%'),
  },
  {
    label: 'Touch top',
    axis: 'y',
    sign: -1,
    unit: 'height',
    scale: 1,
    get: (layout) => layout.keypad.reach,
    set: (layout, reach) => ({
      ...layout,
      keypad: { ...layout.keypad, reach: clamp(reach, 0, 100 - layout.keypad.top) },
    }),
    line: up('calc(var(--keypad-top) + var(--keypad-reach))'),
    knob: across('25%'),
  },
  {
    label: 'Keypad top',
    axis: 'y',
    sign: -1,
    unit: 'height',
    scale: 1,
    get: (layout) => layout.keypad.top,
    // No lower than where the keys' four rows touch, standing on the bottom margin.
    set: (layout, top, sizes) => {
      const keys = bottomMargin(layout, sizes) + 4 * layout.keypad.keyHeight;
      return {
        ...layout,
        keypad: {
          ...layout.keypad,
          top: clamp(top, Math.min(layout.keypad.top, Math.max(5, keys))),
        },
      };
    },
    line: up('var(--keypad-top)'),
    knob: across('50%'),
  },
  {
    label: 'Key width',
    axis: 'x',
    sign: 1,
    unit: 'column',
    scale: 1,
    get: (layout) => layout.keypad.keyWidth,
    // No wider than where the three keys of a row touch, filling the column between the side margins.
    set: (layout, width, sizes) => {
      const keys = 100 - (2 * layout.margins.side * sizes.rem) / sizes.column;
      return {
        ...layout,
        keypad: {
          ...layout.keypad,
          keyWidth: clamp(width, 1, Math.max(layout.keypad.keyWidth, keys / 3)),
        },
      };
    },
    // The first key's right edge: the keys keep to the side margins, whatever their width.
    line: {
      left: 'calc(var(--margin) + var(--margin-side) + var(--keypad-key-width))',
      ...up('calc(var(--keypad-top) - var(--keypad-key-height))'),
      height: 'var(--keypad-key-height)',
    },
    knob: { top: '50%' },
  },
  {
    label: 'Key height',
    axis: 'y',
    sign: 1,
    unit: 'height',
    scale: 1,
    get: (layout) => layout.keypad.keyHeight,
    set: (layout, value, sizes) => {
      // No taller than where the rows touch, the keypad's four rows filling it, from its top to the bottom margin.
      const keys = layout.keypad.top - bottomMargin(layout, sizes);
      const keyHeight = clamp(value, 1, Math.max(layout.keypad.keyHeight, keys / 4));
      const keyRadius = Math.min(layout.keypad.keyRadius, keyHeight / 2);
      return { ...layout, keypad: { ...layout.keypad, keyHeight, keyRadius } };
    },
    // The first row's bottom: the keys hang from the keypad's top, whatever their height.
    line: up('calc(var(--keypad-top) - var(--keypad-key-height))'),
    knob: across('50%'),
  },
  {
    label: 'Key radius',
    axis: 'x',
    sign: 1,
    unit: 'height',
    scale: 1,
    get: (layout) => layout.keypad.keyRadius,
    set: (layout, radius) => ({
      ...layout,
      keypad: { ...layout.keypad, keyRadius: clamp(radius, 0, layout.keypad.keyHeight / 2) },
    }),
    // Where the rounding of the first key's bottom left corner meets its bottom.
    line: point(
      'calc(var(--margin) + var(--margin-side) + var(--keypad-key-radius))',
      'calc(100% - var(--floor) - var(--keypad-top) + var(--keypad-key-height))',
    ),
    knob: { top: '0' },
  },
  {
    label: 'Key depth',
    axis: 'y',
    sign: 1,
    unit: 'height',
    scale: 1,
    get: (layout) => layout.keypad.keyDepth,
    set: (layout, depth) => ({
      ...layout,
      keypad: { ...layout.keypad, keyDepth: clamp(depth, 0, layout.keypad.keyHeight / 2) },
    }),
    // The bottom of the first row's thickness, below their faces.
    line: up('calc(var(--keypad-top) - var(--keypad-key-height) - var(--keypad-key-depth))'),
    knob: across('75%'),
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
        keypad: { ...layout.keypad, top: clamp(rounded(layout.keypad.top + shift, STEPS.height)) },
      };
    },
    line: up('var(--margin-bottom)'),
    knob: across('50%'),
  },
];
