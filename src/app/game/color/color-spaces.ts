/**
 * Colors as `#rrggbb`, and how to blend two of them. Blending in sRGB draws a straight line between the colors, so two
 * colors from opposite sides of the color wheel meet in grey; blending in a space with a hue (HSL, OKLCH) turns the
 * hue round the wheel instead, keeping colors saturated. OKLab and OKLCH are perceptual: equal steps look equal.
 */

/** The spaces two colors can be blended in, named as in CSS (`linear-gradient(in oklch, …)`). */
export const COLOR_SPACES = ['srgb', 'oklab', 'hsl', 'oklch'] as const;

export type ColorSpace = (typeof COLOR_SPACES)[number];

/** How each color space is usually written. */
export const COLOR_SPACE_NAMES: Readonly<Record<ColorSpace, string>> = {
  srgb: 'sRGB',
  oklab: 'OKLab',
  hsl: 'HSL',
  oklch: 'OKLCH',
};

/** A color in HSL: hue in degrees from 0 (red) to 360, saturation and lightness in percent. */
export interface Hsl {
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
}

type Triple = readonly [number, number, number];

/** Which way round the color wheel hues turn when blending. */
export type HueWay = 'short' | 'long';

/**
 * Blends two `#rrggbb` colors in `space`: `t = 0` gives `a`, `t = 1` gives `b`. In a space with a hue, the hue turns the
 * short way round unless told to go the long way.
 */
export function mix(
  a: string,
  b: string,
  t: number,
  space: ColorSpace = 'srgb',
  way: HueWay = 'short',
): string {
  switch (space) {
    case 'srgb':
      return toHex(lerpTriple(rgb(a), rgb(b), t));
    case 'oklab':
      return oklabToHex(lerpTriple(hexToOklab(a), hexToOklab(b), t));
    case 'hsl':
    case 'oklch': {
      const from = toHued(a, space);
      const to = toHued(b, space);
      const turn = shortWay(from.hue, to.hue);
      return fromHued(
        {
          hue: from.hue + (way === 'short' ? turn : longWay(turn)) * t,
          rest: [lerp(from.rest[0], to.rest[0], t), lerp(from.rest[1], to.rest[1], t)],
        },
        space,
      );
    }
  }
}

/** A gradient's two colors, as `#rrggbb`: where it starts (the top of the screen) and where it ends (its bottom). */
export type GradientColors = readonly [start: string, end: string];

/**
 * Blends two gradients in `space`, blending their starts and their ends as {@link mix} does.
 *
 * A gradient drawn in a space with a hue turns from its start hue to its end hue the short way round. Were the starts
 * and the ends each blended the short way, the difference between their hues could pass half the wheel along the way,
 * and the gradient would flip, all at once, to turning the other way round. So when the start and the end would turn
 * against each other like that, one of them goes the long way round instead: whichever makes the trip shorter overall.
 */
export function mixGradients(
  a: GradientColors,
  b: GradientColors,
  t: number,
  space: ColorSpace = 'srgb',
): GradientColors {
  const [start, end] = space === 'hsl' || space === 'oklch' ? hueWays(a, b, space) : SHORT_WAYS;
  return [mix(a[0], b[0], t, space, start), mix(a[1], b[1], t, space, end)];
}

const SHORT_WAYS = ['short', 'short'] as const;

/** Which ways the start and the end of a gradient turn, so that it never flips (see {@link mixGradients}). */
function hueWays(
  a: GradientColors,
  b: GradientColors,
  space: 'hsl' | 'oklch',
): readonly [HueWay, HueWay] {
  const hue = (color: string): number => hueOf(color, space);
  // How far the end's hue is from the start's, as the gradient is drawn: it must change straight from a's to b's.
  const change = shortWay(hue(b[0]), hue(b[1])) - shortWay(hue(a[0]), hue(a[1]));
  const start = shortWay(hue(a[0]), hue(b[0]));
  const end = shortWay(hue(a[1]), hue(b[1]));
  const ways: readonly (readonly [HueWay, HueWay, number, number])[] = [
    ['short', 'short', start, end],
    ['long', 'short', longWay(start), end],
    ['short', 'long', start, longWay(end)],
  ];
  let best: readonly [HueWay, HueWay] = SHORT_WAYS;
  let shortest = Infinity;
  for (const [startWay, endWay, startTurn, endTurn] of ways) {
    const trip = Math.abs(startTurn) + Math.abs(endTurn);
    if (Math.abs(endTurn - startTurn - change) < 1e-6 && trip < shortest) {
      best = [startWay, endWay];
      shortest = trip;
    }
  }
  return best;
}

/** The hue of a `#rrggbb` color in a space with a hue, in degrees from 0 to 360. */
export function hueOf(hex: string, space: 'hsl' | 'oklch'): number {
  return toHued(hex, space).hue;
}

/** How far to turn from hue `a` to hue `b` the short way round: from -180 to 180 degrees. */
export function shortWay(a: number, b: number): number {
  const difference = (((b - a) % 360) + 360) % 360;
  return difference > 180 ? difference - 360 : difference;
}

/** The same turn the other way round the color wheel. */
function longWay(turn: number): number {
  return turn > 0 ? turn - 360 : turn + 360;
}

/** A color in a space with a hue: its hue in degrees, then its other two channels (as in `hsl()` or `oklch()`). */
interface Hued {
  readonly hue: number;
  readonly rest: readonly [number, number];
}

function toHued(hex: string, space: 'hsl' | 'oklch'): Hued {
  if (space === 'hsl') {
    const { hue, saturation, lightness } = hexToHsl(hex);
    return { hue, rest: [saturation, lightness] };
  }
  const [lightness, chroma, hue] = oklch(hexToOklab(hex));
  return { hue, rest: [lightness, chroma] };
}

function fromHued({ hue, rest }: Hued, space: 'hsl' | 'oklch'): string {
  const degrees = ((hue % 360) + 360) % 360;
  if (space === 'hsl') {
    return hslToHex({ hue: degrees, saturation: rest[0], lightness: rest[1] });
  }
  const radians = (degrees * Math.PI) / 180;
  return oklabToHex([rest[0], rest[1] * Math.cos(radians), rest[1] * Math.sin(radians)]);
}

export function hexToHsl(hex: string): Hsl {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness: lightness * 100 };
  }
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const sector =
    max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return {
    hue: (sector * 60 + 360) % 360,
    saturation: saturation * 100,
    lightness: lightness * 100,
  };
}

export function hslToHex({ hue, saturation, lightness }: Hsl): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const channel = (n: number): number => {
    const k = (n + hue / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return toHex([channel(0), channel(8), channel(4)]);
}

/** The sRGB channels of a `#rrggbb` color, from 0 to 1. */
export function rgb(hex: string): Triple {
  const channel = (i: number): number => parseInt(hex.slice(i, i + 2), 16) / 255;
  return [channel(1), channel(3), channel(5)];
}

/** A `#rrggbb` color from its sRGB channels, each kept between 0 and 1. */
export function toHex(values: Triple): string {
  return `#${values
    .map((c) =>
      Math.round(Math.min(1, Math.max(0, c)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** sRGB channels without their gamma: proportional to light. */
export function linearRgb(hex: string): Triple {
  const [r, g, b] = rgb(hex);
  return [toLinear(r), toLinear(g), toLinear(b)];
}

function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055;
}

function hexToOklab(hex: string): Triple {
  const [r, g, b] = linearRgb(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToHex([lightness, a, b]: Triple): string {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return toHex([
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]);
}

/** OKLab as lightness, chroma and hue in degrees. */
function oklch([lightness, a, b]: Triple): Triple {
  return [lightness, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpTriple(a: Triple, b: Triple, t: number): Triple {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
