import type { Values } from '../../../game/grouping/break-models/break-model';

/**
 * A plot, as the views of the break model (`model-views.ts` and the others here) make them and `PlotChart` draws them:
 * what it shows, its ranges, and its marks, in its own units.
 */

/** A point of a plot, in its own units. */
export type Point = readonly [x: number, y: number];

/**
 * What a mark stands for, which sets how it's drawn: what the break model makes of all the runs stands out, the runs
 * picked are thinner, breaks are red, what only helps reading is faint, and the settings shown are dashed.
 */
export type Role = 'aggregate' | 'run' | 'break' | 'faint' | 'guide';

/** One kind of mark on a plot. */
export type Layer =
  | {
      readonly kind: 'line';
      readonly points: readonly (Point | undefined)[];
      readonly role: Role;
      readonly color?: string;
    }
  | { readonly kind: 'dots'; readonly points: readonly Point[]; readonly role: Role }
  | { readonly kind: 'hline'; readonly y: number; readonly role: Role; readonly color?: string }
  | { readonly kind: 'vline'; readonly x: number; readonly role: Role; readonly color?: string }
  | { readonly kind: 'band'; readonly from: number; readonly to: number; readonly role: Role }
  | {
      readonly kind: 'bars';
      readonly bars: readonly {
        readonly from: number;
        readonly to: number;
        readonly height: number;
      }[];
      readonly role: Role;
    };

/** A plot of one step of the break model: what it shows, its ranges, and its marks, the first drawn first. */
export interface Plot {
  readonly title: string;
  readonly caption: string;
  readonly x: {
    readonly min: number;
    readonly max: number;
    readonly labels: readonly [string, string];
  };
  readonly y: { readonly min: number; readonly max: number };
  readonly layers: readonly Layer[];
}

/** A range of values. */
export interface Range {
  readonly min: number;
  readonly max: number;
}

/** The x-axis of a plot along the places, as the charts of the times have it. */
export function alongPlaces(places: number): Plot['x'] {
  return { min: 0, max: Math.max(places - 1, 1), labels: ['Place 1', `Place ${String(places)}`] };
}

export function clamp(value: number, { min, max }: Range): number {
  return Math.min(max, Math.max(min, value));
}

/** The points of values by index, at their places. */
export function pointsOf(values: Values): (Point | undefined)[] {
  return values.map((value, i) => (value === undefined ? undefined : ([i, value] as const)));
}
