/**
 * Color math for tuning colors in developer mode: hue, saturation and lightness (HSL), the usual way to pick colors,
 * and how different two colors look (ΔE 2000) or how well white text reads on a color (WCAG contrast).
 */

/** A color in HSL: hue in degrees from 0 (red) to 360, saturation and lightness in percent. */
export interface Hsl {
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
}

type Triple = readonly [number, number, number];

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

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

/** The color halfway between two others, hue, saturation and lightness each on their own; hues the short way round. */
export function averageHsl(first: Hsl, second: Hsl): Hsl {
  let difference = second.hue - first.hue;
  if (difference > 180) {
    difference -= 360;
  } else if (difference < -180) {
    difference += 360;
  }
  return {
    hue: (first.hue + difference / 2 + 360) % 360,
    saturation: (first.saturation + second.saturation) / 2,
    lightness: (first.lightness + second.lightness) / 2,
  };
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
