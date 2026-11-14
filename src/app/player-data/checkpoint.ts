import { computed, inject, Service, signal } from '@angular/core';
import { isCheckpoint, unlockedCheckpoints } from '../game/modes/checkpoints';
import { GAME_MODES, GameMode } from '../game/modes/game-mode';
import { migrate, Migration } from './migration';
import { reachedPlace } from './run';
import { RunStore } from './run-store';

/** The name of the setting of the places picked in the store. */
export const CHECKPOINTS = 'checkpoints';
/** The format of the stored setting, which changes, with a migration, whenever the setting does. */
export const CHECKPOINTS_FORMAT = 3;
/** The steps that bring the setting in older formats to the current one, one per format (see {@link migrate}). */
const CHECKPOINTS_MIGRATIONS: readonly Migration[] = [
  // Format 2 names Discover Discovery.
  ({ places, ...setting }) => {
    if (typeof places !== 'object' || places === null) {
      return setting;
    }
    const { discover, ...picked } = places as Record<string, unknown>;
    return { ...setting, places: { ...picked, discovery: discover } };
  },
  // Format 3 says whether each game mode starts from its place, none of them yet, and whether the player has switched one.
  (setting) => ({ ...setting, from: START_FROM, switched: false }),
];

/** The place picked for each game mode. */
export type PickedPlaces = Readonly<Record<GameMode, number>>;

/** Whether each game mode starts from its place, rather than from the start of π. */
export type StartsFrom = Readonly<Record<GameMode, boolean>>;

interface CheckpointsValue {
  readonly format: typeof CHECKPOINTS_FORMAT;
  readonly places: PickedPlaces;
  readonly from: StartsFrom;
  readonly switched: boolean;
}

const START: PickedPlaces = { free: 0, challenge: 0, discovery: 0 };
const START_FROM: StartsFrom = { free: false, challenge: false, discovery: false };
const STARTING: Omit<CheckpointsValue, 'format'> = {
  places: START,
  from: START_FROM,
  switched: false,
};

/**
 * The checkpoints the player has unlocked, and the place picked for each game mode to start from on the main menu: the
 * start of π, place 0, or a checkpoint. Checkpoints aren't kept: they're worked out from the runs, every checked run
 * unlocking those up to the place it reached, whatever its game mode. The places picked are kept with the player's
 * data; a place no longer unlocked, as once runs are deleted, gives the farthest one still unlocked before it. So is
 * whether each game mode starts from its place, switched on the main menu, none of them at first, and whether the
 * player has ever switched one there.
 */
@Service()
export class Checkpoint {
  private readonly store = inject(RunStore);
  /** The checkpoints unlocked, in order. */
  readonly unlocked = computed(() =>
    unlockedCheckpoints(
      this.store
        .runs()
        .filter((run) => run.checked)
        .map(reachedPlace),
    ),
  );
  /** The farthest place a game can start from: the last checkpoint unlocked, or the start of π. */
  readonly farthest = computed(() => this.unlocked().at(-1) ?? 0);
  private readonly kept = signal(STARTING);
  /** Whether the player has ever switched a game mode to start from its place, or back, on the main menu. */
  readonly switched = computed(() => this.kept().switched);
  /** Settles once the stored setting has been read. */
  readonly loaded: Promise<void>;
  private changed = false;

  constructor() {
    this.loaded = this.store.setting(CHECKPOINTS).then((stored) => {
      // Unless it was changed in the meantime.
      if (!this.changed) {
        this.kept.set(parseSetting(stored));
      }
    });
  }

  /** The place a game mode starts from, as picked, as far as it's unlocked. */
  place(mode: GameMode): number {
    return this.reachable(this.kept().places[mode]);
  }

  /** Whether a game mode starts from its place, once a checkpoint is unlocked, rather than from the start of π. */
  startsFrom(mode: GameMode): boolean {
    return this.farthest() > 0 && this.kept().from[mode];
  }

  /** The place a game mode starts from: its place, if it starts from it, or the start of π. */
  start(mode: GameMode): number {
    return this.startsFrom(mode) ? this.place(mode) : 0;
  }

  /** The place a game can start from when asked for `place`: the farthest checkpoint unlocked up to it, if any. */
  reachable(place: number): number {
    return Math.max(0, ...this.unlocked().filter((checkpoint) => checkpoint <= place));
  }

  /** Reads the stored setting again, once something else changed it, such as restoring a backup. */
  async reload(): Promise<void> {
    this.kept.set(parseSetting(await this.store.setting(CHECKPOINTS)));
  }

  /** Picks the place a game mode starts from, and keeps it for the next visits. */
  pick(mode: GameMode, place: number): Promise<void> {
    return this.keep(({ places, ...kept }) => ({ ...kept, places: { ...places, [mode]: place } }));
  }

  /** Switches a game mode to start from its place, or from the start of π, as the player does. */
  switchTo(mode: GameMode, from: boolean): Promise<void> {
    return this.keep((kept) => ({ ...kept, from: { ...kept.from, [mode]: from }, switched: true }));
  }

  /** Picks a checkpoint the game mode reached for it to start from, and switches it to start from it. */
  reach(mode: GameMode, place: number): Promise<void> {
    return this.keep((kept) => ({
      ...kept,
      places: { ...kept.places, [mode]: place },
      from: { ...kept.from, [mode]: true },
    }));
  }

  /** Changes what's kept, and keeps it for the next visits. */
  private async keep(
    change: (kept: Omit<CheckpointsValue, 'format'>) => Omit<CheckpointsValue, 'format'>,
  ): Promise<void> {
    this.changed = true;
    this.kept.update(change);
    const setting: CheckpointsValue = { format: CHECKPOINTS_FORMAT, ...this.kept() };
    await this.store.saveSetting(CHECKPOINTS, setting);
  }
}

/**
 * What a stored setting keeps: for each game mode, the start of π for a place it doesn't know, starting from it only if
 * it says so; and as at first, in a format it doesn't know.
 */
function parseSetting(stored: unknown): Omit<CheckpointsValue, 'format'> {
  if (typeof stored !== 'object' || stored === null) {
    return STARTING;
  }
  const { format, places, from, switched } = migrate(stored, CHECKPOINTS_MIGRATIONS);
  if (format !== CHECKPOINTS_FORMAT || typeof places !== 'object' || places === null) {
    return STARTING;
  }
  const picked = places as Record<string, unknown>;
  const starts = (typeof from === 'object' && from !== null ? from : {}) as Record<string, unknown>;
  return {
    places: Object.fromEntries(
      GAME_MODES.map((mode) => {
        const place = picked[mode];
        return [mode, typeof place === 'number' && isCheckpoint(place) ? place : 0];
      }),
    ) as Record<GameMode, number>,
    from: Object.fromEntries(GAME_MODES.map((mode) => [mode, starts[mode] === true])) as Record<
      GameMode,
      boolean
    >,
    switched: switched === true,
  };
}
