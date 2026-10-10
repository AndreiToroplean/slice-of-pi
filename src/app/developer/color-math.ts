/**
 * Color math for tuning colors in developer mode: OKLCH, a color space where equal steps look like equal changes, and
 * how different two colors look (ΔE 2000) or how well white text reads on a color (WCAG contrast).
 */

/** A color in OKLCH: lightness from 0 to 1, chroma (colorfulness) from 0, hue in degrees. */
export type Oklch = readonly [lightness: number, chroma: number, hue: number];

type Triple = readonly [number, number, number];

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number): number =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

function rgb(hex: string): Triple {
  const channel = (i: number): number => parseInt(hex.slice(i, i + 2), 16) / 255;
  return [channel(1), channel(3), channel(5)];
}

function linearRgb(hex: string): Triple {
  const [r, g, b] = rgb(hex);
  return [toLinear(r), toLinear(g), toLinear(b)];
}

function toHex(values: Triple): string {
  return `#${values
    .map((c) =>
      Math.round(Math.min(1, Math.max(0, c)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = linearRgb(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [lightness, Math.hypot(a, bb), ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360];
}

/** An OKLCH color in sRGB, or `undefined` when sRGB can't show it. */
function oklchToRgb([lightness, chroma, hue]: Oklch): Triple | undefined {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear: Triple = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  if (linear.some((c) => c < -0.0005 || c > 1.0005)) {
    return undefined;
  }
  return [
    fromLinear(Math.min(1, Math.max(0, linear[0]))),
    fromLinear(Math.min(1, Math.max(0, linear[1]))),
    fromLinear(Math.min(1, Math.max(0, linear[2]))),
  ];
}

/** An OKLCH color as `#rrggbb`, made less colorful as needed for sRGB to show it. */
export function oklchToHex([lightness, chroma, hue]: Oklch): string {
  for (let c = chroma; c > 0; c -= 0.002) {
    const shown = oklchToRgb([lightness, c, hue]);
    if (shown !== undefined) {
      return toHex(shown);
    }
  }
  return toHex(oklchToRgb([lightness, 0, hue]) ?? [lightness, lightness, lightness]);
}

function luminance(hex: string): number {
  const [r, g, b] = linearRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast ratio of white text on a color, from 1 to 21. */
export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

function hexToLab(hex: string): Triple {
  const [r, g, b] = linearRgb(hex);
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** How different two colors look (ΔE 2000): under 10 they look almost the same, under 15 they're easy to mix up. */
export function colorDifference(first: string, second: string): number {
  const [l1, a1, b1] = hexToLab(first);
  const [l2, a2, b2] = hexToLab(second);
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cMean = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(cMean ** 7 / (cMean ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const h1 = (Math.atan2(b1, a1p) * deg + 360) % 360;
  const h2 = (Math.atan2(b2, a2p) * deg + 360) % 360;
  const dL = l2 - l1;
  const dC = c2p - c1p;
  let dh = h2 - h1;
  if (c1p * c2p === 0) {
    dh = 0;
  } else if (dh > 180) {
    dh -= 360;
  } else if (dh < -180) {
    dh += 360;
  }
  const dH = 2 * Math.sqrt(c1p * c2p) * Math.sin((dh / 2) * rad);
  const lMean = (l1 + l2) / 2;
  const cMeanP = (c1p + c2p) / 2;
  let hMean = h1 + h2;
  if (c1p * c2p !== 0) {
    hMean =
      Math.abs(h1 - h2) <= 180
        ? (h1 + h2) / 2
        : h1 + h2 < 360
          ? (h1 + h2 + 360) / 2
          : (h1 + h2 - 360) / 2;
  }
  const t =
    1 -
    0.17 * Math.cos((hMean - 30) * rad) +
    0.24 * Math.cos(2 * hMean * rad) +
    0.32 * Math.cos((3 * hMean + 6) * rad) -
    0.2 * Math.cos((4 * hMean - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hMean - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cMeanP ** 7 / (cMeanP ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lMean - 50) ** 2) / Math.sqrt(20 + (lMean - 50) ** 2);
  const sc = 1 + 0.045 * cMeanP;
  const sh = 1 + 0.015 * cMeanP * t;
  const rt = -Math.sin(2 * dTheta * rad) * rc;
  return Math.sqrt((dL / sl) ** 2 + (dC / sc) ** 2 + (dH / sh) ** 2 + rt * (dC / sc) * (dH / sh));
}

/** Two colors of a palette, by index, and how different they look. */
export interface ColorPair {
  readonly first: number;
  readonly second: number;
  readonly difference: number;
}

/** Every pair of a palette's colors, the closest first. */
export function closestPairs(colors: readonly string[]): ColorPair[] {
  const pairs: ColorPair[] = [];
  colors.forEach((first, i) => {
    colors.slice(i + 1).forEach((second, j) => {
      pairs.push({ first: i, second: i + 1 + j, difference: colorDifference(first, second) });
    });
  });
  return pairs.sort((a, b) => a.difference - b.difference);
}
