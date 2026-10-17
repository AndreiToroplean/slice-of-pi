import { BreakModel, breakModel, BreakSettings, FinishedRuns, Mixture } from './break-model';
import { VENUS } from './venus';

/** What a setting is, why it works that way, and what moving it does, as its help on Your Runs says. */
export interface Help {
  readonly what: string;
  readonly why: string;
  readonly moving: string;
}

/**
 * One of the break models the game can take the player's breaks, and so their groups, from (`groupings.md` §4.1),
 * named after the planets. Every one works out the same things from the runs' times, a {@link BreakModel}, from the
 * same settings.
 */
export interface BreakModelChoice {
  /** What it's called in the stored tweaks and in the values copied from Your Runs. */
  readonly name: string;
  /** What it's called on Your Runs. */
  readonly label: string;
  /** What it does, in a sentence. */
  readonly description: string;
  /** What a setting means in this model, where it isn't what its slider's help says. */
  readonly help?: Partial<Readonly<Record<keyof BreakSettings, Help>>>;
  /**
   * Runs the model over the finished runs and, if given, the times of the run in progress (in milliseconds since its
   * first digit), which is then the newest. `init` is the last mixture fitted, to start the fit from.
   */
  readonly run: (
    finished: FinishedRuns,
    current: readonly number[] | undefined,
    settings: BreakSettings,
    init?: Mixture,
  ) => BreakModel;
}

/** Mercury, the original break model (`break-model.ts`). */
const MERCURY: BreakModelChoice = {
  name: 'mercury',
  label: 'Mercury',
  description: 'The original: each run’s breaks, then how often the runs break at each place.',
  run: breakModel,
};

/** The break models, picked on Your Runs in developer mode: the first is the game's. */
export const BREAK_MODELS: readonly [BreakModelChoice, ...BreakModelChoice[]] = [MERCURY, VENUS];

/** The break model the game takes the breaks from. */
export const BREAK_MODEL = BREAK_MODELS[0];

/** The break model of that name, if any. */
export function breakModelNamed(name: unknown): BreakModelChoice | undefined {
  return BREAK_MODELS.find((model) => model.name === name);
}
