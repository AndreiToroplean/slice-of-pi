import { WritableSignal } from '@angular/core';

/**
 * What a handle's value is measured in: rem, hundredths of the screen's height, or of the column's width, or `px`, a
 * value of no length, which moves by so much for each CSS pixel the handle is dragged (see {@link Handle.scale}).
 */
export type HandleUnit = 'rem' | 'height' | 'column' | 'px';

/** How many CSS pixels each unit of length is, on the screen as laid out now. */
export type UnitSizes = Readonly<Record<Exclude<HandleUnit, 'px'>, number>>;

/**
 * A handle of an editor, dragged up and down or across to change one value of what it edits, `T`. It may lie on an edge
 * the value sets, along a line, or on a ring round a point, its knob, which takes the drag, somewhere along it; or it
 * may be a knob alone, in a row of them.
 */
export interface Handle<T> extends HandleShape {
  readonly get: (value: T) => number;
  /** `T` with the value set, kept within what `T` allows. */
  readonly set: (value: T, to: number, sizes: UnitSizes) => T;
}

/** A handle, but for what it edits: how it looks and moves. */
export interface HandleShape {
  readonly label: string;
  /** Which way it's dragged: `y` up and down, along a line across; `x` across, along an upright line or a ring. */
  readonly axis: 'x' | 'y';
  /** Which way dragging it raises its value: `1` down or right, `-1` up or left. */
  readonly sign: 1 | -1;
  readonly unit: HandleUnit;
  /** How far the handle moves for each unit its value changes, in units, or in pixels for a value of no length. */
  readonly scale: number;
  /** The finest step of its value, for a value of no length or one finer or coarser than its unit's (see {@link STEPS}). */
  readonly step?: number;
  /** Where its line lies, in CSS, or its ring, with `ring`; none for a knob alone. */
  readonly line?: Readonly<Record<string, string>>;
  /** Whether its line is a ring, round the point its line's box is centered on. */
  readonly ring?: boolean;
  /** Where its knob sits along its line. */
  readonly knob?: Readonly<Record<string, string>>;
}

/** The finest step of each unit: a sixteenth of a rem, a pixel at the browser's default size, a tenth of the others. */
export const STEPS: Readonly<Record<HandleUnit, number>> = {
  rem: 0.0625,
  height: 0.1,
  column: 0.1,
  px: 0.01,
};

/** The finest step of a handle's value. */
export function stepOf(handle: HandleShape): number {
  return handle.step ?? STEPS[handle.unit];
}

/** A value rounded to a step, so that the values copied stay short. */
export function rounded(value: number, step: number): number {
  return Number((Math.round(value / step) * step).toFixed(6));
}

/** `value` once a handle has been dragged `distance` CSS pixels, down or right, from where it was. */
export function dragged<T>(handle: Handle<T>, value: T, distance: number, sizes: UnitSizes): T {
  const unit = handle.unit === 'px' ? 1 : sizes[handle.unit];
  const change = (handle.sign * distance) / (unit * handle.scale);
  return handle.set(value, rounded(handle.get(value) + change, stepOf(handle)), sizes);
}

/** `value` once a handle's value has been stepped `steps` times, up or down, as with the arrow keys. */
export function stepped<T>(handle: Handle<T>, value: T, steps: number, sizes: UnitSizes): T {
  const step = stepOf(handle);
  return handle.set(value, rounded(handle.get(value) + steps * step, step), sizes);
}

/** A handle of something, bound to it: what the handles' component (see `handles.ts`) moves. */
export interface BoundHandle {
  readonly handle: HandleShape;
  /** Its value now. */
  readonly value: () => number;
  /** Notes where a drag starts, for {@link drag} to measure from. */
  readonly grab: () => void;
  /** Moves it `distance` CSS pixels, down or right, from where the drag started. */
  readonly drag: (distance: number, sizes: UnitSizes) => void;
  /** Steps its value, as with the arrow keys. */
  readonly step: (steps: number, sizes: UnitSizes) => void;
}

/** A handle bound to a signal holding what it edits. */
export function bind<T>(handle: Handle<T>, value: WritableSignal<T>): BoundHandle {
  // Read once a drag starts, as the signal may have no value before.
  let from: T | undefined;
  return {
    handle,
    value: () => handle.get(value()),
    grab: () => {
      from = value();
    },
    drag: (distance, sizes) => {
      value.set(dragged(handle, from ?? value(), distance, sizes));
    },
    step: (steps, sizes) => {
      value.set(stepped(handle, value(), steps, sizes));
    },
  };
}
