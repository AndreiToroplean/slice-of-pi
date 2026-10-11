/**
 * Color math for tuning colors in developer mode: averaging two colors in hue, saturation and lightness (HSL), the usual
 * way to pick colors, and how different two colors look (ΔE 2000).
 */

import { Hsl, linearRgb } from '../colors/color-spaces';

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

function hexToLab(hex: string): readonly [number, number, number] {
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
