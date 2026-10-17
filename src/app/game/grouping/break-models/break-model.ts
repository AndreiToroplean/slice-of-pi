import type { GroupPlan } from '../groups';
import type { Steps } from './steps';

/**
 * What a break model is to the rest of the game. A break model takes the times of the player's runs and finds where they
 * break, so where their groups are, and how far that can be trusted. Its hyperparameters, and how it works them into its
 * answer, are its own: models are plugged in and out in `break-models.ts`, and developer mode picks one.
 *
 * The game sees a model with its hyperparameters set, a {@link BreakModel}: the play screen gets its {@link Gameplay},
 * Your Runs its {@link Stats}. Only developer mode sees a model's {@link BreakModelKind}: its hyperparameters, to tune
 * them, and its steps, to show them one by one.
 */

/** Values by index; `undefined` where there's none. */
export type Values = readonly (number | undefined)[];

/** A break before the digit at index `place` (index 0 is the first digit typed), and how clear it is, from 0 to 1. */
export interface Break {
  readonly place: number;
  readonly strength: number;
}

/** A group of digits cut by the usual break spots. */
export interface Group {
  /** The index of its first digit. */
  readonly start: number;
  readonly size: number;
  /** Whether it runs to the end of the data, with no break known to end it. */
  readonly open: boolean;
  /** Whether the break that ends it can be trusted. */
  readonly trusted: boolean;
}

/** A break model with its hyperparameters set: all the game sees of it. */
export interface BreakModel {
  /** How the groups are played over the player's finished runs, oldest first, for the run about to be typed. */
  play(finished: readonly (readonly number[])[]): Gameplay;
  /** What the model makes of the player's finished runs, oldest first, for them to see. */
  stats(finished: readonly (readonly number[])[]): Stats;
}

/**
 * How the groups are played while the player types a run. Each answer takes the run as typed so far, `current`, since
 * the model follows it too.
 */
export interface Gameplay {
  /** How the group starting at index `start` is played. */
  groupAt(current: readonly number[], start: number): GroupPlan;
  /**
   * Whether the group being typed is finished before the next digit, the last of `current`, timed as if typed now.
   * `trusted` is whether its plan was.
   */
  groupEnds(current: readonly number[], trusted: boolean): boolean;
}

/** What the model makes of the player's finished runs, for them to see. */
export interface Stats {
  /** Each run, in the order given. */
  readonly runs: readonly RunStats[];
  /** Where the player usually breaks. */
  readonly usual: readonly Break[];
  readonly groups: readonly Group[];
  /** The time per digit the model expects at each index over the runs, without breaks, in milliseconds. */
  readonly speedCurve: Values;
  /** The time per digit at each index over the runs, recent ones weighing more, in milliseconds. */
  readonly averageTime: Values;
  /** How sure the model is of its verdict at each index, a usual break or not, from 0 to 1. */
  readonly confidence: Values;
}

/** What the model makes of one run. */
export interface RunStats {
  readonly breaks: readonly Break[];
  /** The time per digit expected at each index of the run without breaks, in milliseconds. */
  readonly baseline: Values;
}

/** The hyperparameters of a model, by name. */
export type Settings = Readonly<Record<string, number>>;

/** A hyperparameter, as its slider shows it in developer mode. Stored values outside its range aren't taken. */
export interface Hyperparameter {
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly format: (value: number) => string;
  /** What it is, why it works that way, and what moving it does. */
  readonly help: { readonly what: string; readonly why: string; readonly moving: string };
}

/** The sliders of a tab, in order. */
export interface HyperparameterTab {
  readonly name: string;
  readonly hyperparameters: readonly Hyperparameter[];
}

/** A break model as developer mode sees it: what it's called, its hyperparameters, and how to set them. */
export interface BreakModelKind {
  /** What it's called in the stored tweaks. */
  readonly name: string;
  /** What it's called in developer mode. */
  readonly label: string;
  /** What it does, in a sentence. */
  readonly description: string;
  readonly defaults: Settings;
  /** Where its defaults are in the code, for the values copied in developer mode. */
  readonly defaultsIn: string;
  /** Its hyperparameters, each in one tab. */
  readonly tabs: readonly HyperparameterTab[];
  /** The model, with these hyperparameters, each of them it isn't given at its default. */
  readonly create: (settings: Settings) => BreakModel;
  /** What it makes of the finished runs step by step, with these hyperparameters, if developer mode can show it. */
  readonly steps?: (settings: Settings, finished: readonly (readonly number[])[]) => Steps;
}
