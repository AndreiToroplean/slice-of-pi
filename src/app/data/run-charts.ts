import { Run } from '../runs/run';

/** Values along the places of π, by index (index 0 is place 1); `undefined` where there's no value. */
export type Series = readonly (number | undefined)[];

/**
 * How long the player took to type each digit of a run, in milliseconds: the time since the digit before. The first
 * digit has none, as the run's clock starts on it.
 */
export function digitTimes(run: Run): Series {
  return run.times.map((time, i) => (i === 0 ? undefined : time - (run.times[i - 1] ?? 0)));
}

/** The average of the series at each place, over those that have a value there. */
export function average(series: readonly Series[]): Series {
  const length = Math.max(0, ...series.map((values) => values.length));
  return Array.from({ length }, (_, i) => {
    const values = series.flatMap((values) => values[i] ?? []);
    return values.length === 0 ? undefined : values.reduce((a, b) => a + b, 0) / values.length;
  });
}

/**
 * The time at the top of the charts, in milliseconds, the same for every chart so that they compare: whole seconds,
 * enough for nearly every digit. The longest pauses are cut off, so they don't flatten everything else.
 */
export function chartTop(series: readonly Series[]): number {
  const times = series
    .flatMap((values) => values.filter((value) => value !== undefined))
    .sort((a, b) => a - b);
  const typical = times[Math.floor(times.length * 0.95)] ?? 0;
  return Math.max(1000, Math.ceil((typical * 1.2) / 1000) * 1000);
}

/** The height of a chart, in the units of its `viewBox`. */
export const CHART_HEIGHT = 100;

/**
 * The line of a series, as SVG path data for a chart `places` wide: place 1 at x = 0, one unit per place, and `top`
 * milliseconds at the top. Values above the top are cut off at it; places without a value break the line.
 */
export function chartPath(values: Series, top: number): string {
  let path = '';
  let drawing = false;
  values.forEach((value, i) => {
    if (value === undefined) {
      drawing = false;
      return;
    }
    const y = CHART_HEIGHT * (1 - Math.min(value, top) / top);
    // A point on its own is drawn as a dot (with round line caps).
    path += drawing ? `L${String(i)} ${round(y)}` : `M${String(i)} ${round(y)}h0`;
    drawing = true;
  });
  return path;
}

function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}
