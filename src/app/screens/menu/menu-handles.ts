import { Handle } from '../../ui/handles/handle';
import { EditedPart } from '../../ui/handles/parts';
import {
  BUTTON_COUNT,
  ICON_LIGHT_OFFSET,
  LAYOUT_FIELDS,
  LIGHT_FIELDS,
  LightLayer,
  LightSettings,
  MenuLook,
  withLayout,
  withIconLight,
  withLight,
} from './menu-look';

/** A part of the menu the editor picks out, to edit it. */
export type MenuPart = 'icon' | 'slice' | 'pi' | 'buttons';

/** What each part is called. */
export const PART_NAMES: Readonly<Record<MenuPart, string>> = {
  icon: 'Icon',
  slice: '“Slice of”',
  pi: '“Pi”',
  buttons: 'Buttons',
};

/**
 * How wide each line of the name is, and how tall, in its letters' size: lanterns 1.25 wide and 1.625 tall, 0.19 apart
 * within a word and 0.55 between words (see `menu.css`).
 */
export const LINE_SIZES: Readonly<Record<'slice' | 'pi', { width: number; height: number }>> = {
  slice: { width: 7 * 1.25 + 5 * 0.19 + 0.55, height: 1.625 },
  pi: { width: 2 * 1.25 + 0.19, height: 1.625 },
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** A part's middle, `offset` above the center of the icon and the name: an offset as the look keeps it, or the center. */
type Height = 'icon' | 'slice' | 'pi';

/** The parts above each, which a drag of its height carries along: the name's lines stand on one another, from "Pi" up. */
const ABOVE: Readonly<Record<'icon' | 'slice', readonly ('icon' | 'slice')[]>> = {
  icon: [],
  slice: ['icon'],
};

/**
 * A part's height, dragged up and down, carrying along the parts above it, as they stand on one another: "Pi", at the
 * bottom, moves the whole group, its center, in hundredths of the menu's height; "Slice of" moves itself and the icon,
 * and the icon itself alone, their offsets from the center, in hundredths of the column's width, as their sizes are.
 */
function height(part: Height, knob: string): Handle<MenuLook> {
  const shape = {
    label: `${PART_NAMES[part]} height`,
    text: 'Height',
    axis: 'y',
    sign: -1,
    scale: 1,
    line: { bottom: `var(--${part}-y)` },
    knob: { left: knob },
  } as const;
  if (part === 'pi') {
    const field = LAYOUT_FIELDS.title[0];
    return {
      ...shape,
      unit: 'height',
      get: (look) => look.layout.title.y,
      set: (look, y) => withLayout(look, 'title', 'y', clamp(y, field.min, field.max)),
    };
  }
  const field = LAYOUT_FIELDS[part][1];
  return {
    ...shape,
    unit: 'column',
    get: (look) => look.layout[part].offset,
    set: (look, value) => {
      const offset = clamp(value, field.min, field.max);
      const shift = offset - look.layout[part].offset;
      return ABOVE[part].reduce(
        (moved, above) =>
          withLayout(
            moved,
            above,
            'offset',
            clamp(moved.layout[above].offset + shift, field.min, field.max),
          ),
        withLayout(look, part, 'offset', offset),
      );
    },
  };
}

/**
 * A part's size, dragged across by its right edge, which moves by half as much as its width changes, as it stays
 * centered: `width` and `tall` are its width and height in its size.
 */
function size(
  part: 'icon' | 'slice' | 'pi',
  width: number,
  tall: number,
  max: number,
): Handle<MenuLook> {
  return {
    label: `${PART_NAMES[part]} size`,
    text: 'Size',
    axis: 'x',
    sign: 1,
    unit: 'column',
    scale: width / 2,
    get: (look) => look.layout[part].size,
    set: (look, value) => withLayout(look, part, 'size', clamp(value, 1, max)),
    line: {
      left: `calc(50% + ${String(width / 2)} * var(--${part}-size))`,
      bottom: `calc(var(--${part}-y) - ${String(tall / 2)} * var(--${part}-size))`,
      height: `calc(${String(tall)} * var(--${part}-size))`,
    },
    // Above its top end, within the screen, however near its edge.
    knob: { top: '0', left: '0', translate: '-50% calc(-100% - 0.25rem)' },
  };
}

/**
 * A value of the buttons, dragged up and down by a line at `line` above the group's middle, which moves by `scale` for
 * each unit of the value, as the group stays around its middle.
 */
function buttons(
  key: 'height' | 'gap',
  label: string,
  text: string,
  line: string,
  scale: number,
  knob: string,
): Handle<MenuLook> {
  const field = LAYOUT_FIELDS.buttons.find((each) => each.key === key) ?? LAYOUT_FIELDS.buttons[0];
  return {
    label,
    text,
    axis: 'y',
    sign: -1,
    unit: 'rem',
    scale,
    get: (look) => look.layout.buttons[key],
    set: (look, value) => withLayout(look, 'buttons', key, clamp(value, field.min, field.max)),
    line: { bottom: `calc(var(--buttons-y) + ${line})` },
    knob: { left: knob },
  };
}

/** Where the buttons stand: their middle's height, dragged by their bottom edge. */
const BUTTONS_HEIGHT: Handle<MenuLook> = {
  label: 'Buttons height',
  text: 'Height',
  axis: 'y',
  sign: -1,
  unit: 'height',
  scale: 1,
  get: (look) => look.layout.buttons.y,
  set: (look, y) => withLayout(look, 'buttons', 'y', clamp(y, 0, 100)),
  line: { bottom: 'calc(var(--buttons-y) - var(--buttons-span) / 2)' },
  knob: { left: '18%' },
};

/** The height of the icon's light, dragged up and down, with the icon. */
const ICON_LIGHT_HEIGHT: Handle<MenuLook> = {
  label: 'Icon light height',
  text: 'Light',
  axis: 'y',
  sign: -1,
  unit: 'column',
  scale: 1,
  get: (look) => look.iconLight.offset,
  set: (look, offset) =>
    withIconLight(look, {
      offset: clamp(offset, ICON_LIGHT_OFFSET.min, ICON_LIGHT_OFFSET.max),
    }),
  line: { bottom: 'var(--icon-light-y)' },
  knob: { left: '86%' },
};

/** The handles of each part, on its edges. */
export const PART_HANDLES: Readonly<Record<MenuPart, readonly Handle<MenuLook>[]>> = {
  icon: [height('icon', '14%'), iconSize(), ICON_LIGHT_HEIGHT],
  slice: [
    height('slice', '10%'),
    size('slice', LINE_SIZES.slice.width, LINE_SIZES.slice.height, 14),
  ],
  pi: [height('pi', '30%'), size('pi', LINE_SIZES.pi.width, LINE_SIZES.pi.height, 20)],
  buttons: [
    BUTTONS_HEIGHT,
    // The top of the group, which grows by half as much on each side as all the buttons together.
    buttons('height', 'Button size', 'Size', 'var(--buttons-span) / 2', BUTTON_COUNT / 2, '82%'),
    // The bottom of the first, above the first gap.
    buttons(
      'gap',
      'Button gap',
      'Gap',
      'var(--buttons-span) / 2 - var(--buttons-height)',
      (BUTTON_COUNT - 1) / 2,
      '50%',
    ),
  ],
};

/** The icon's size, by its right edge: it's square, a hundredth of the column wide for each unit, and as tall. */
function iconSize(): Handle<MenuLook> {
  return {
    ...size('icon', 1, 1, 90),
    scale: 0.5,
    line: {
      left: 'calc(50% + var(--icon-size) / 2)',
      bottom: 'calc(var(--icon-y) - var(--icon-size) / 2)',
      height: 'var(--icon-size)',
    },
  };
}

/** The light of each part that gives off light. */
export const PART_LIGHTS: Readonly<Partial<Record<MenuPart, LightLayer>>> = {
  icon: 'icon',
  slice: 'slice',
  pi: 'pi',
};

/** Where a light is, in CSS pixels from the menu's top left corner. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The core of a layer's light, as a ring round where its lights are, `at`, as wide as the core, dragged out and in by
 * its knob, on its right. Its size, in hundredths of the menu's height, as the core's, is that of the container the
 * handles are in (`cqh`).
 */
export function coreHandle(layer: LightLayer, at: Point, look: MenuLook): Handle<MenuLook> {
  const field = lightField('core');
  return {
    label: 'Light core',
    text: 'Core',
    axis: 'x',
    sign: 1,
    unit: 'height',
    scale: 1,
    get: (value) => value.light[layer].core,
    set: (value, core) => withLight(value, layer, 'core', clamp(core, field.min, field.max)),
    ring: true,
    line: {
      left: `${String(at.x)}px`,
      top: `${String(at.y)}px`,
      width: `calc(2 * ${String(look.light[layer].core)}cqh)`,
      height: `calc(2 * ${String(look.light[layer].core)}cqh)`,
    },
  };
}

/** How far each of a light's values of no length moves for each CSS pixel dragged: one step for every few pixels. */
const PIXELS_PER_UNIT: Readonly<Partial<Record<keyof LightSettings, number>>> = {
  intensity: 100,
  falloff: 50,
  rays: 150,
  rayCount: 8,
  saturation: 100,
};

/** The values of a layer's light but its core, each a knob dragged across, in a row. */
export function lightKnobs(layer: LightLayer): readonly Handle<MenuLook>[] {
  return LIGHT_FIELDS.filter(({ key }) => key !== 'core').map(
    ({ key, label, min, max, step }): Handle<MenuLook> => ({
      label,
      axis: 'x',
      sign: 1,
      ...(key === 'reach'
        ? { unit: 'height', scale: 1, step: 1 }
        : { unit: 'px', scale: PIXELS_PER_UNIT[key] ?? 100, step }),
      get: (look) => look.light[layer][key],
      set: (look, value) => withLight(look, layer, key, clamp(value, min, max)),
    }),
  );
}

function lightField(key: keyof LightSettings): (typeof LIGHT_FIELDS)[number] {
  const field = LIGHT_FIELDS.find((each) => each.key === key);
  if (field === undefined) {
    throw new Error(`No light field ${key}`);
  }
  return field;
}

/** Each part's box, in the menu's lengths (see `menuStyles`), from the top. */
export const PART_BOXES: readonly EditedPart<MenuPart>[] = [
  {
    id: 'icon',
    name: PART_NAMES.icon,
    box: centered('var(--icon-y)', 'var(--icon-size)', 'var(--icon-size)'),
  },
  ...(['slice', 'pi'] as const).map((id): EditedPart<MenuPart> => ({
    id,
    name: PART_NAMES[id],
    box: centered(
      `var(--${id}-y)`,
      `calc(${String(LINE_SIZES[id].width)} * var(--${id}-size))`,
      `calc(${String(LINE_SIZES[id].height)} * var(--${id}-size))`,
    ),
  })),
  {
    id: 'buttons',
    name: PART_NAMES.buttons,
    box: centered(
      'var(--buttons-y)',
      'min(100% - 2 * (var(--margin-side) + var(--margin)), 16rem)',
      'var(--buttons-span)',
    ),
  },
];

/** A box centered across, its middle at `y`, up from the menu's bottom. */
function centered(y: string, width: string, height: string): Readonly<Record<string, string>> {
  return { left: '50%', bottom: y, width, height, translate: '-50% 50%' };
}
