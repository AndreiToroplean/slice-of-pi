import { Handle } from '../../ui/handles/handle';
import {
  LIGHT_FIELDS,
  LightLayer,
  LightSettings,
  MenuLayout,
  MenuLook,
  withLayout,
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

/** A part's height, its middle's, up from the menu's bottom, dragged up and down. */
function height(part: 'icon' | 'slice' | 'pi', knob: string): Handle<MenuLook> {
  return {
    label: `${PART_NAMES[part]} height`,
    text: 'Height',
    axis: 'y',
    sign: -1,
    unit: 'height',
    scale: 1,
    get: (look) => look.layout[part].y,
    set: (look, y) => withLayout(look, part, 'y', clamp(y, 0, 100)),
    line: { bottom: `var(--${part}-y)` },
    knob: { left: knob },
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

/** Up from the bottom margin, where the buttons stand, plus `length`. */
const aboveMargin = (length: string): Readonly<Record<string, string>> => ({
  bottom: `calc(var(--floor) + var(--margin-bottom) + var(--buttons-bottom) + ${length})`,
});

/** A value of the buttons, in rem, from `min` up. */
function buttons(
  key: keyof MenuLayout['buttons'],
  label: string,
  line: string,
  knob: string,
  min: number,
): Handle<MenuLook> {
  return {
    label,
    axis: 'y',
    sign: -1,
    unit: 'rem',
    scale: 1,
    get: (look) => look.layout.buttons[key],
    set: (look, value) => withLayout(look, 'buttons', key, clamp(value, min, 20)),
    line: aboveMargin(line),
    knob: { left: knob },
  };
}

/** The handles of each part, on its edges. */
export const PART_HANDLES: Readonly<Record<MenuPart, readonly Handle<MenuLook>[]>> = {
  icon: [height('icon', '14%'), iconSize()],
  slice: [
    height('slice', '10%'),
    size('slice', LINE_SIZES.slice.width, LINE_SIZES.slice.height, 14),
  ],
  pi: [height('pi', '30%'), size('pi', LINE_SIZES.pi.width, LINE_SIZES.pi.height, 20)],
  buttons: [
    buttons('bottom', 'Buttons bottom', '0px', '18%', 0),
    buttons('height', 'Button height', 'var(--buttons-height)', '82%', 2),
    buttons('gap', 'Button gap', 'var(--buttons-height) + var(--buttons-gap)', '50%', 0),
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
