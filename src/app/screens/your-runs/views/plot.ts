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
  /** An area between two lines, such as a range around a value at each place; broken where either has no point. */
  | {
      readonly kind: 'area';
      readonly upper: readonly (Point | undefined)[];
      readonly lower: readonly (Point | undefined)[];
      readonly role: Role;
    }
  /**
   * Bars from their base, the bottom of the plot if none, to their height; faded, for what they'd be without something,
   * behind the bars of what they are.
   */
  | {
      readonly kind: 'bars';
      readonly bars: readonly {
        readonly from: number;
        readonly to: number;
        readonly height: number;
        readonly base?: number;
      }[];
      readonly role: Role;
      readonly faded?: boolean;
    };

/** A value marked on the y-axis, with a faint line across the plot. */
export interface Tick {
  readonly value: number;
  readonly label: string;
}

/** What a kind of mark on a plot stands for, as its key shows it: a swatch drawn like the mark, and what it is. */
export interface Key {
  readonly mark: 'line' | 'dots' | 'area' | 'bars';
  readonly role: Role;
  readonly color?: string;
  readonly faded?: boolean;
  readonly label: string;
}

/**
 * A plot of one step of the break model: what it shows, its ranges, its marks, the first drawn first, and the key to
 * them.
 */
export interface Plot {
  readonly title: string;
  readonly caption: string;
  readonly x: {
    readonly min: number;
    readonly max: number;
    readonly labels: readonly [string, string];
    /** Whether x is the index of a place, as along the charts of the times, so that a place can be picked on it. */
    readonly places?: boolean;
    /** What an x reads as, for the ends of a window zoomed into: without it, the labels stay. */
    readonly label?: (x: number) => string;
  };
  readonly y: { readonly min: number; readonly max: number; readonly ticks?: readonly Tick[] };
  readonly layers: readonly Layer[];
  /** What each kind of mark stands for, those that only help reading aside. */
  readonly legend?: readonly Key[];
}

/** What tells a key apart from the others of its plot, and the marks it stands for. */
export function keyIdOf(key: {
  readonly mark: Key['mark'];
  readonly role: Role;
  readonly color?: string | undefined;
  readonly faded?: boolean | undefined;
}): string {
  return `${key.mark} ${key.role} ${key.color ?? ''}${key.faded === true ? ' faded' : ''}`;
}

/** The swatch a layer's marks show as in a key. */
export function markOf(layer: Layer): Key['mark'] {
  switch (layer.kind) {
    case 'line':
    case 'hline':
    case 'vline':
      return 'line';
    case 'area':
    case 'band':
      return 'area';
    default:
      return layer.kind;
  }
}

/** The key a layer's marks show under: its id. */
export function keyIdOfLayer(layer: Layer): string {
  return keyIdOf({
    mark: markOf(layer),
    role: layer.role,
    color: 'color' in layer ? layer.color : undefined,
    faded: 'faded' in layer ? layer.faded : undefined,
  });
}

/** A range of values. */
export interface Range {
  readonly min: number;
  readonly max: number;
}

/** The x-axis of a plot along the places, as the charts of the times have it. */
export function alongPlaces(places: number): Plot['x'] {
  return {
    min: 0,
    max: Math.max(places - 1, 1),
    labels: ['Place 1', `Place ${String(places)}`],
    places: true,
    label: (x) => `Place ${String(Math.round(x) + 1)}`,
  };
}

export function clamp(value: number, { min, max }: Range): number {
  return Math.min(max, Math.max(min, value));
}

/** The points of values by index, at their places. */
export function pointsOf(values: Values): (Point | undefined)[] {
  return values.map((value, i) => (value === undefined ? undefined : ([i, value] as const)));
}
