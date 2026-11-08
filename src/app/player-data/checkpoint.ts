import { computed, inject, Service, signal } from '@angular/core';
import { isCheckpoint, unlockedCheckpoints } from '../game/modes/checkpoints';
import { GAME_MODES, GameMode } from '../game/modes/game-mode';
import { migrate, Migration } from './migration';
import { reachedPlace } from './run';
import { RunStore } from './run-store';

/** The name of the setting of the places picked in the store. */
export const CHECKPOINTS = 'checkpoints';
/** The format of the stored setting, which changes, with a migration, whenever the setting does. */
export const CHECKPOINTS_FORMAT = 1;
/** The steps that bring the setting in older formats to the current one, one per format (see {@link migrate}). */
const CHECKPOINTS_MIGRATIONS: readonly Migration[] = [];

/** The place picked for each game mode. */
export type PickedPlaces = Readonly<Record<GameMode, number>>;

interface CheckpointsValue {
  readonly format: typeof CHECKPOINTS_FORMAT;
  readonly places: PickedPlaces;
}

const START: PickedPlaces = { free: 0, challenge: 0, discover: 0 };

/**
 * The checkpoints the player has unlocked, and the place picked for each game mode to start from on the main menu: the
 * start of π, place 0, or a checkpoint. Checkpoints aren't kept: they're worked out from the runs, every checked run
 * unlocking those up to the place it reached, whatever its game mode. The places picked are kept with the player's
 * data; a place no longer unlocked, as once runs are deleted, gives the farthest one still unlocked before it.
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
  private readonly picked = signal<PickedPlaces>(START);
  /** Settles once the stored setting has been read. */
  readonly loaded: Promise<void>;
  private changed = false;

  constructor() {
    this.loaded = this.store.setting(CHECKPOINTS).then((stored) => {
      // Unless it was changed in the meantime.
      if (!this.changed) {
        this.picked.set(parseSetting(stored));
      }
    });
  }

  /** The place a game mode starts from, as picked, as far as it's unlocked. */
  place(mode: GameMode): number {
    return this.reachable(this.picked()[mode]);
  }

  /** The place a game can start from when asked for `place`: the farthest checkpoint unlocked up to it, if any. */
  reachable(place: number): number {
    return Math.max(0, ...this.unlocked().filter((checkpoint) => checkpoint <= place));
  }

  /** Reads the stored setting again, once something else changed it, such as restoring a backup. */
  async reload(): Promise<void> {
    this.picked.set(parseSetting(await this.store.setting(CHECKPOINTS)));
  }

  /** Picks the place a game mode starts from, and keeps it for the next visits. */
  async pick(mode: GameMode, place: number): Promise<void> {
    this.changed = true;
    this.picked.update((places) => ({ ...places, [mode]: place }));
    const setting: CheckpointsValue = { format: CHECKPOINTS_FORMAT, places: this.picked() };
    await this.store.saveSetting(CHECKPOINTS, setting);
  }
}

/** The places a stored setting picks: the start of π for each one it doesn't know, or in a format it doesn't. */
function parseSetting(stored: unknown): PickedPlaces {
  if (typeof stored !== 'object' || stored === null) {
    return START;
  }
  const { format, places } = migrate(stored, CHECKPOINTS_MIGRATIONS);
  if (format !== CHECKPOINTS_FORMAT || typeof places !== 'object' || places === null) {
    return START;
  }
  const picked = places as Record<string, unknown>;
  return Object.fromEntries(
    GAME_MODES.map((mode) => {
      const place = picked[mode];
      return [mode, typeof place === 'number' && isCheckpoint(place) ? place : 0];
    }),
  ) as Record<GameMode, number>;
}
