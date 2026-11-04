import { BackgroundColors } from '../../game/layers/seasons';

/** The main menu's background, a sky at twilight: deep blue at the top, the last of the light at the bottom. */
export const TWILIGHT: BackgroundColors = ['#19224d', '#be5a23'];

/**
 * How the main menu looks: where its parts sit, and the light its lanterns and icon give. Everything stays centered
 * across: only sizes and heights are set. The icon and the name's lines are a group, kept together whatever the menu's
 * height: only the group's center is a height of the menu, in hundredths of it, up from its bottom; each part's middle
 * is an offset from that center, up, and each part's size, both in hundredths of the column's width (see `app.css`).
 * The buttons are a group too: its middle is a height of the menu, as the title's is, and each button's height, and the
 * gap between any two, are in rem, as every page's controls are sized.
 */
export interface MenuLayout {
  /** The height of the center of the icon and the name, together. */
  readonly title: { readonly y: number };
  /** The icon's width, and how far its middle is above the center. */
  readonly icon: { readonly size: number; readonly offset: number };
  /** The size of the letters of "Slice of", and how far their middle is above the center. */
  readonly slice: { readonly size: number; readonly offset: number };
  /** The size of the letters of "Pi", and how far their middle is above the center. */
  readonly pi: { readonly size: number; readonly offset: number };
  /** Each button's height, the gap between any two, and how far above the bottom margin the last one stands, in rem. */
  readonly buttons: { readonly y: number; readonly height: number; readonly gap: number };
}

/**
 * The light of one of the menu's layers, each of its lights the same (see `light-layer.ts`): a glow that fades as
 * `intensity / (1 + (r / core)²)^(falloff / 2)` (a Moffat profile, as stars glow in photographs), down to nothing at
 * `reach`, and rays overlaid on it. Lengths are hundredths of the menu's height.
 */
export interface LightSettings {
  /** How bright the glow is at its middle. */
  readonly intensity: number;
  /** How wide its bright core is: about the distance at which it's half as bright. */
  readonly core: number;
  /** How fast it fades past its core: far out, as `1 / r^falloff`. */
  readonly falloff: number;
  /** How far it reaches, where it has faded to nothing. */
  readonly reach: number;
  /** How strongly the rays brighten and darken the glow, from 0, none, to 1. */
  readonly rays: number;
  /** About how many rays go round. */
  readonly rayCount: number;
  /** How much more colorful the light is than what gives it, from 1, as colorful. */
  readonly saturation: number;
}

/** The menu's layers of light, from the back: each lights everything behind it, as well as the background. */
export const LIGHT_LAYERS = ['icon', 'slice', 'pi'] as const;

export type LightLayer = (typeof LIGHT_LAYERS)[number];

export interface MenuLook {
  readonly layout: MenuLayout;
  readonly light: Readonly<Record<LightLayer, LightSettings>>;
  /** Where the light behind the icon is, how far above the icon's middle, as the icon's offset is, and its color. */
  readonly iconLight: { readonly offset: number; readonly color: string };
}

/** How many buttons the menu has, one above the other. */
export const BUTTON_COUNT = 2;

/** The menu's own look. */
export const MENU_LOOK: MenuLook = {
  layout: {
    title: { y: 53.4 },
    icon: { size: 48.7, offset: 11.8 },
    slice: { size: 7.9, offset: -20.7 },
    pi: { size: 13.5, offset: -40.9 },
    buttons: { y: 14, height: 3.25, gap: 0.875 },
  },
  light: {
    icon: {
      intensity: 0.97,
      core: 7.7,
      falloff: 2.3,
      reach: 26,
      rays: 0.92,
      rayCount: 5,
      saturation: 1.5,
    },
    slice: {
      intensity: 0.38,
      core: 5.1,
      falloff: 3.95,
      reach: 12,
      rays: 0.64,
      rayCount: 4,
      saturation: 3,
    },
    pi: {
      intensity: 0.45,
      core: 4,
      falloff: 1.3,
      reach: 13,
      rays: 1,
      rayCount: 3,
      saturation: 1.2,
    },
  },
  iconLight: { offset: -3.6, color: '#ff6857' },
};

/** A value of the look, as the editor shows it: what it's called, its range, and how finely it moves. */
export interface LookField<T> {
  readonly key: keyof T & string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/** The values of each part of the layout. */
export const LAYOUT_FIELDS = {
  title: [{ key: 'y', label: 'Height', min: 0, max: 100, step: 0.5 }],
  icon: [
    { key: 'size', label: 'Size', min: 5, max: 90, step: 0.5 },
    { key: 'offset', label: 'Offset', min: -150, max: 150, step: 0.1 },
  ],
  slice: [
    { key: 'size', label: 'Size', min: 2, max: 14, step: 0.1 },
    { key: 'offset', label: 'Offset', min: -150, max: 150, step: 0.1 },
  ],
  pi: [
    { key: 'size', label: 'Size', min: 2, max: 20, step: 0.1 },
    { key: 'offset', label: 'Offset', min: -150, max: 150, step: 0.1 },
  ],
  buttons: [
    { key: 'height', label: 'Height', min: 2, max: 6, step: 0.0625 },
    { key: 'gap', label: 'Gap', min: 0, max: 4, step: 0.0625 },
    { key: 'y', label: 'Height', min: 0, max: 100, step: 0.1 },
  ],
} as const satisfies {
  readonly [K in keyof MenuLayout]: readonly LookField<MenuLayout[K]>[];
};

/** The values of a layer's light. */
export const LIGHT_FIELDS: readonly LookField<LightSettings>[] = [
  { key: 'intensity', label: 'Intensity', min: 0, max: 2, step: 0.01 },
  { key: 'core', label: 'Core', min: 0.2, max: 30, step: 0.1 },
  { key: 'falloff', label: 'Falloff', min: 0.5, max: 6, step: 0.05 },
  { key: 'reach', label: 'Reach', min: 5, max: 150, step: 1 },
  { key: 'rays', label: 'Rays', min: 0, max: 1, step: 0.01 },
  { key: 'rayCount', label: 'Ray count', min: 2, max: 64, step: 1 },
  { key: 'saturation', label: 'Saturation', min: 1, max: 3, step: 0.05 },
];

/** The look with one value of a part of its layout set. */
export function withLayout<K extends keyof MenuLayout>(
  look: MenuLook,
  part: K,
  key: keyof MenuLayout[K],
  value: number,
): MenuLook {
  return {
    ...look,
    layout: { ...look.layout, [part]: { ...look.layout[part], [key]: value } },
  };
}

/** The offset of the icon's light, from the icon's middle. */
export const ICON_LIGHT_OFFSET: LookField<{ offset: number }> = {
  key: 'offset',
  label: 'Light height',
  min: -60,
  max: 60,
  step: 0.1,
};

/** The look with the icon's light moved, or of another color. */
export function withIconLight(look: MenuLook, iconLight: Partial<MenuLook['iconLight']>): MenuLook {
  return { ...look, iconLight: { ...look.iconLight, ...iconLight } };
}

/** The look with one value of a layer's light set. */
export function withLight(
  look: MenuLook,
  layer: LightLayer,
  key: keyof LightSettings,
  value: number,
): MenuLook {
  return { ...look, light: { ...look.light, [layer]: { ...look.light[layer], [key]: value } } };
}

/**
 * The look as the CSS lengths the menu lays out with: `--icon-size` and `--icon-y`, `--icon-light-y`, `--slice-size`
 * and `--slice-y`, `--pi-size` and `--pi-y`, `--buttons-y`, `--buttons-height`, `--buttons-gap`, and `--buttons-span`,
 * how tall the buttons are together. Each `-y` is the height of a middle, up from the menu's bottom, as a percentage of
 * the menu's height plus a length.
 */
export function menuStyles(look: MenuLook): Readonly<Record<string, string>> {
  const { title, icon, slice, pi, buttons } = look.layout;
  const across = (value: number): string => `calc(${String(value)} * var(--column) / 100)`;
  const up = (offset: number): string =>
    `calc(${String(title.y)}% + ${String(offset)} * var(--column) / 100)`;
  const rem = (value: number): string => `${String(value)}rem`;
  return {
    '--icon-size': across(icon.size),
    '--icon-y': up(icon.offset),
    '--icon-light-y': up(icon.offset + look.iconLight.offset),
    '--slice-size': across(slice.size),
    '--slice-y': up(slice.offset),
    '--pi-size': across(pi.size),
    '--pi-y': up(pi.offset),
    '--buttons-y': `${String(buttons.y)}%`,
    '--buttons-height': rem(buttons.height),
    '--buttons-gap': rem(buttons.gap),
    '--buttons-span': rem(BUTTON_COUNT * buttons.height + (BUTTON_COUNT - 1) * buttons.gap),
  };
}

/**
 * A look read from untrusted data, or `undefined` if it isn't one. Each value missing or out of its range takes the
 * menu's own, so that adding or dropping one keeps the others.
 */
export function parseMenuLook(value: unknown): MenuLook | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const layout = isRecord(value['layout']) ? value['layout'] : {};
  const light = isRecord(value['light']) ? value['light'] : {};
  const iconLight = value['iconLight'];
  return {
    layout: {
      title: parsed(MENU_LOOK.layout.title, LAYOUT_FIELDS.title, layout['title']),
      icon: parsed(MENU_LOOK.layout.icon, LAYOUT_FIELDS.icon, layout['icon']),
      slice: parsed(MENU_LOOK.layout.slice, LAYOUT_FIELDS.slice, layout['slice']),
      pi: parsed(MENU_LOOK.layout.pi, LAYOUT_FIELDS.pi, layout['pi']),
      buttons: parsed(MENU_LOOK.layout.buttons, LAYOUT_FIELDS.buttons, layout['buttons']),
    },
    light: {
      icon: parsed(MENU_LOOK.light.icon, LIGHT_FIELDS, light['icon']),
      slice: parsed(MENU_LOOK.light.slice, LIGHT_FIELDS, light['slice']),
      pi: parsed(MENU_LOOK.light.pi, LIGHT_FIELDS, light['pi']),
    },
    iconLight: {
      ...parsed({ offset: MENU_LOOK.iconLight.offset }, [ICON_LIGHT_OFFSET], iconLight),
      color:
        isRecord(iconLight) && isColor(iconLight['color'])
          ? iconLight['color']
          : MENU_LOOK.iconLight.color,
    },
  };
}

function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

/** `value`'s fields, each in its range, or else the one in `defaults`. */
function parsed<T extends object>(defaults: T, fields: readonly LookField<T>[], value: unknown): T {
  const stored = isRecord(value) ? value : {};
  return Object.fromEntries(
    fields.map(({ key, min, max }) => {
      const each = stored[key];
      return [key, typeof each === 'number' && each >= min && each <= max ? each : defaults[key]];
    }),
  ) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
