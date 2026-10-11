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

/** Blends two `#rrggbb` colors in `space`: `t = 0` gives `a`, `t = 1` gives `b`; hues go the short way round. */
export function mix(a: string, b: string, t: number, space: ColorSpace = 'srgb'): string {
  switch (space) {
    case 'srgb':
      return toHex(lerpTriple(rgb(a), rgb(b), t));
    case 'oklab':
      return oklabToHex(lerpTriple(hexToOklab(a), hexToOklab(b), t));
    case 'hsl': {
      const from = hexToHsl(a);
      const to = hexToHsl(b);
      return hslToHex({
        hue: lerpHue(from.hue, to.hue, t),
        saturation: lerp(from.saturation, to.saturation, t),
        lightness: lerp(from.lightness, to.lightness, t),
      });
    }
    case 'oklch': {
      const [l1, c1, h1] = oklch(hexToOklab(a));
      const [l2, c2, h2] = oklch(hexToOklab(b));
      const hue = (lerpHue(h1, h2, t) * Math.PI) / 180;
      const chroma = lerp(c1, c2, t);
      return oklabToHex([lerp(l1, l2, t), chroma * Math.cos(hue), chroma * Math.sin(hue)]);
    }
  }
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

/** Hues the short way round the color wheel. */
function lerpHue(a: number, b: number, t: number): number {
  let difference = b - a;
  if (difference > 180) {
    difference -= 360;
  } else if (difference < -180) {
    difference += 360;
  }
  return (a + difference * t + 360) % 360;
}
