import { climbTime, MilestoneWave, waveValue } from './milestone-wave';

/** How far up the wave's slope is measured, in screen heights, for how much it bends the screen along its climb. */
const SLOPE_STEP = 0.01;
/** How much more the wave's slope bends the screen along its climb than its value does inward. */
const SLOPE_BEND = 6;

/**
 * How a wave bends the screen under it, on a grid of `columns` by `rows` over the screen, row by row from the top:
 * where each point shows the screen from, as how far off, in CSS pixels, right and down (`x` and `y`), and how much
 * further its red is taken, and its blue as much the other way, for its colors to split (`splitX` and `splitY`).
 */
export interface ScreenBend {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly splitX: Float32Array;
  readonly splitY: Float32Array;
  /** The furthest any of them goes, in CSS pixels. */
  readonly reach: number;
}

/**
 * How a wave bends a screen `width` by `height` CSS pixels, `elapsed` seconds in, within its gradient from the edges:
 * each point shows the screen from further in as the wave's value is, and from up or down along its climb as its slope
 * is, as through a ripple; its colors split apart, inward, as far from 0 as the value is.
 */
export function screenBend(
  wave: MilestoneWave,
  first: boolean,
  elapsed: number,
  width: number,
  height: number,
  columns: number,
  rows: number,
): ScreenBend {
  const size = columns * rows;
  const bend = {
    x: new Float32Array(size),
    y: new Float32Array(size),
    splitX: new Float32Array(size),
    splitY: new Float32Array(size),
  };
  const shorter = Math.min(width, height);
  let reach = 0;
  for (let row = 0; row < rows; row++) {
    // From the bottom, as the wave climbs.
    const up = 1 - (row + 0.5) / rows;
    const value = waveValue(wave, first, elapsed - climbTime(wave, up));
    const slope = waveValue(wave, first, elapsed - climbTime(wave, up + SLOPE_STEP)) - value;
    for (let column = 0; column < columns; column++) {
      const across = (column + 0.5) / columns;
      const edge =
        Math.min(across * width, (1 - across) * width, up * height, (1 - up) * height) / shorter;
      const gradient = Math.max(0, 1 - edge / wave.depth) ** wave.falloff;
      if (gradient === 0 || (value === 0 && slope === 0)) {
        continue;
      }
      // Toward the middle of the screen.
      const inX = (0.5 - across) * width;
      const inY = (0.5 - up) * height;
      const length = Math.hypot(inX, inY) || 1;
      const towardX = inX / length;
      const towardY = inY / length;
      const i = row * columns + column;
      // In screen heights both ways, as the mockup bent them.
      const x = towardX * value * wave.distortion * gradient * height;
      // Down the screen, as the grid's rows go, rather than up it.
      const y = -(towardY * value + slope * SLOPE_BEND) * wave.distortion * gradient * height;
      const split = wave.colorSplit * Math.abs(value) * gradient;
      bend.x[i] = x;
      bend.y[i] = y;
      bend.splitX[i] = towardX * split * height;
      bend.splitY[i] = -towardY * split * height;
      reach = Math.max(
        reach,
        Math.abs(x) + Math.abs(bend.splitX[i] ?? 0),
        Math.abs(y) + Math.abs(bend.splitY[i] ?? 0),
      );
    }
  }
  return { ...bend, reach };
}

/**
 * A displacement map of a bend, for an SVG filter's `feDisplacementMap` at `scale`: each point's red how far right it
 * shows the screen from, its green how far down, both from 128, none, as far as half the scale either way; its split
 * added `split` times, 1 for the red's, -1 for the blue's, 0 for the green's.
 */
export function displacementMap(
  bend: ScreenBend,
  split: -1 | 0 | 1,
  scale: number,
): Uint8ClampedArray<ArrayBuffer> {
  const pixels = new Uint8ClampedArray(bend.x.length * 4);
  for (let i = 0; i < bend.x.length; i++) {
    const x = (bend.x[i] ?? 0) + split * (bend.splitX[i] ?? 0);
    const y = (bend.y[i] ?? 0) + split * (bend.splitY[i] ?? 0);
    pixels[i * 4] = Math.round(255 * (0.5 + x / scale));
    pixels[i * 4 + 1] = Math.round(255 * (0.5 + y / scale));
    pixels[i * 4 + 2] = 128;
    pixels[i * 4 + 3] = 255;
  }
  return pixels;
}
