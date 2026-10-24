import type { Steps } from '../../../game/grouping/break-models/steps';
import type { Role, Tick } from './plot';

/** What the views are made of: the steps of the model over the runs counted, and what of them to show. */
export interface ViewInput {
  readonly model: Steps;
  /** The runs picked, by their index in the model's runs. */
  readonly picked: readonly number[];
  /** Whether to show what the model makes of all the runs. */
  readonly aggregate: boolean;
  /** How many places the plots along the places span, as the charts of the times do. */
  readonly places: number;
  /** The settings to show on the charts, where they have a place. */
  readonly guides: ReadonlySet<string>;
}

/**
 * The runs the views of each run show: the runs picked, or all of them while none is but all of them are shown, and
 * how they're drawn: all of them faint, so that they read as a cloud.
 */
export function runsShown({ model, picked, aggregate }: ViewInput): {
  readonly runs: readonly number[];
  readonly role: Role;
} {
  return picked.length > 0 || !aggregate
    ? { runs: picked, role: 'run' }
    : { runs: model.runs.map((_, k) => k), role: 'faint' };
}

/** Intervals marked on a log-interval axis, in milliseconds. */
const INTERVAL_TICKS = [50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000];

/** The intervals marked on a log-interval axis, as milliseconds or seconds. */
export function intervalTicks(): Tick[] {
  return INTERVAL_TICKS.map((ms) => ({
    value: Math.log(ms),
    label: ms < 1000 ? `${String(ms)} ms` : `${String(ms / 1000)} s`,
  }));
}

/** Ticks at whole multiples of `step` within the range, labeled as numbers. */
export function stepTicks(min: number, max: number, step: number): Tick[] {
  const ticks: Tick[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max; value += step) {
    ticks.push({ value, label: format(value) });
  }
  return ticks;
}

/** A number as short as it reads: whole numbers bare, others to two significant digits. */
export function format(value: number): string {
  if (Math.abs(value) < 1e-9) {
    return '0';
  }
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(2)));
}

/** A round step for ticks over a span: 1, 2 or 5 times a power of 10, for about five of them. */
export function niceStep(span: number): number {
  const power = 10 ** Math.floor(Math.log10(Math.max(span, 1e-9) / 5));
  const steps = [1, 2, 5, 10].map((each) => each * power);
  return steps.reduce((best, step) =>
    Math.abs(span / step - 5) < Math.abs(span / best - 5) ? step : best,
  );
}
