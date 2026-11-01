/**
 * How the main menu looks: where its parts sit, and the light its lanterns and icon give. Everything stays centered
 * across: only sizes and heights are set. Heights are hundredths of the menu's height, measured up from its bottom, and
 * sizes hundredths of the column's width (see `app.css`); the buttons, like every page's controls, are sized in rem.
 */
export interface MenuLayout {
  /** The icon's width, and the height of its middle. */
  readonly icon: { readonly size: number; readonly y: number };
  /** The size of the letters of "Slice of", and the height of their middle. */
  readonly slice: { readonly size: number; readonly y: number };
  /** The size of the letters of "Pi", and the height of their middle. */
  readonly pi: { readonly size: number; readonly y: number };
  /** Each button's height, the gap between any two, and how far above the bottom margin the last one stands, in rem. */
  readonly buttons: { readonly height: number; readonly gap: number; readonly bottom: number };
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
}

/** The menu's own look. */
export const MENU_LOOK: MenuLook = {
  layout: {
    icon: { size: 38, y: 66 },
    slice: { size: 8.2, y: 51 },
    pi: { size: 11.3, y: 42.5 },
    buttons: { height: 3.25, gap: 0.875, bottom: 3 },
  },
  light: {
    icon: {
      intensity: 0.9,
      core: 9,
      falloff: 2,
      reach: 70,
      rays: 0.9,
      rayCount: 14,
      saturation: 1,
    },
    slice: {
      intensity: 0.8,
      core: 3.5,
      falloff: 2,
      reach: 55,
      rays: 0.9,
      rayCount: 14,
      saturation: 1.6,
    },
    pi: {
      intensity: 0.8,
      core: 4.5,
      falloff: 2,
      reach: 60,
      rays: 0.9,
      rayCount: 14,
      saturation: 1.6,
    },
  },
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
  icon: [
    { key: 'size', label: 'Size', min: 5, max: 90, step: 0.5 },
    { key: 'y', label: 'Height', min: 0, max: 100, step: 0.5 },
  ],
  slice: [
    { key: 'size', label: 'Size', min: 2, max: 14, step: 0.1 },
    { key: 'y', label: 'Height', min: 0, max: 100, step: 0.5 },
  ],
  pi: [
    { key: 'size', label: 'Size', min: 2, max: 20, step: 0.1 },
    { key: 'y', label: 'Height', min: 0, max: 100, step: 0.5 },
  ],
  buttons: [
    { key: 'height', label: 'Height', min: 2, max: 6, step: 0.0625 },
    { key: 'gap', label: 'Gap', min: 0, max: 4, step: 0.0625 },
    { key: 'bottom', label: 'Bottom', min: 0, max: 20, step: 0.0625 },
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
 * The layout as the CSS lengths the menu lays out with: `--icon-size` and `--icon-y`, `--slice-size` and `--slice-y`,
 * `--pi-size` and `--pi-y`, `--buttons-height`, `--buttons-gap` and `--buttons-bottom`.
 */
export function menuStyles(layout: MenuLayout): Readonly<Record<string, string>> {
  const { icon, slice, pi, buttons } = layout;
  const across = (value: number): string => `calc(${String(value)} * var(--column) / 100)`;
  const up = (value: number): string => `${String(value)}%`;
  const rem = (value: number): string => `${String(value)}rem`;
  return {
    '--icon-size': across(icon.size),
    '--icon-y': up(icon.y),
    '--slice-size': across(slice.size),
    '--slice-y': up(slice.y),
    '--pi-size': across(pi.size),
    '--pi-y': up(pi.y),
    '--buttons-height': rem(buttons.height),
    '--buttons-gap': rem(buttons.gap),
    '--buttons-bottom': rem(buttons.bottom),
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
  return {
    layout: {
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
  };
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
