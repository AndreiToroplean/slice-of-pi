import { BreakModel, BreakSettings, FinishedRuns, Mixture } from './break-model';

/** What a setting is, why it works that way, and what moving it does, as its help on Your Runs says. */
export interface Help {
  readonly what: string;
  readonly why: string;
  readonly moving: string;
}

/**
 * A model the groups can come from (`groupings.md` §4): all the game knows of it. Each one works out the same things
 * from the runs' times (a {@link BreakModel}) and says when a group ends while the player types; models are plugged in
 * and out in `grouping-models.ts`.
 */
export interface GroupingModel {
  /** What it's called in the stored tweaks and in the values copied from Your Runs. */
  readonly name: string;
  /** What it's called on Your Runs. */
  readonly label: string;
  /** The hyperparameters it uses, among the grouping settings, each with a slider on Your Runs. */
  readonly settings: readonly (keyof BreakSettings)[];
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
  /**
   * Whether the group being typed is finished before the next digit, at index `next`, from what the model makes of the
   * runs with the run being typed, its next digit timed as if typed now. `trusted` if it's the player's own group,
   * within the trust horizon.
   */
  readonly groupEnds: (
    model: BreakModel,
    next: number,
    trusted: boolean,
    settings: BreakSettings,
  ) => boolean;
}
