import { inject, Service, signal } from '@angular/core';
import { DEFAULT_GROUP_SIZE, isGroupSize } from '../game/grouping/group-size';
import { migrate, Migration } from './migration';
import { RunStore } from './run-store';

/** The name of the group size setting in the store. */
export const GROUP_SIZE = 'group-size';
/** The format of the stored setting, which changes, with a migration, whenever the setting does. */
export const GROUP_SIZE_FORMAT = 1;
/** The steps that bring the setting in older formats to the current one, one per format (see {@link migrate}). */
const GROUP_SIZE_MIGRATIONS: readonly Migration[] = [];

interface GroupSizeValue {
  readonly format: typeof GROUP_SIZE_FORMAT;
  readonly size: number;
}

/**
 * How many slots a group starts with where the game doesn't know the player's groups yet (see {@link DEFAULT_GROUP_SIZE}),
 * as the player picked it on the settings page. Kept with the player's data, and 5 until it's read from there.
 */
@Service()
export class GroupSizeSetting {
  private readonly store = inject(RunStore);
  private readonly picked = signal(DEFAULT_GROUP_SIZE);

  readonly size = this.picked.asReadonly();
  /** Settles once the stored setting has been read. */
  readonly loaded: Promise<void>;
  private changed = false;

  constructor() {
    this.loaded = this.store.setting(GROUP_SIZE).then((stored) => {
      // Unless it was changed in the meantime.
      if (!this.changed) {
        this.picked.set(parseSetting(stored));
      }
    });
  }

  /** Reads the stored setting again, once something else changed it, such as restoring a backup. */
  async reload(): Promise<void> {
    this.picked.set(parseSetting(await this.store.setting(GROUP_SIZE)));
  }

  /** Picks the size, and keeps it for the next visits. */
  async set(size: number): Promise<void> {
    this.changed = true;
    this.picked.set(size);
    const setting: GroupSizeValue = { format: GROUP_SIZE_FORMAT, size };
    await this.store.saveSetting(GROUP_SIZE, setting);
  }
}

/** The size a stored setting picks. A setting in a format this version doesn't know, or out of range, picks 5. */
function parseSetting(stored: unknown): number {
  if (typeof stored !== 'object' || stored === null) {
    return DEFAULT_GROUP_SIZE;
  }
  const { format, size } = migrate(stored, GROUP_SIZE_MIGRATIONS);
  return format === GROUP_SIZE_FORMAT && isGroupSize(size) ? size : DEFAULT_GROUP_SIZE;
}
