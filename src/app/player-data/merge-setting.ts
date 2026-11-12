import { inject, Service, signal } from '@angular/core';
import { migrate, Migration } from './migration';
import { RunStore } from './run-store';

/** The name of the merge setting in the store. */
export const MERGE = 'merge';
/** The format of the stored setting, which changes, with a migration, whenever the setting does. */
export const MERGE_FORMAT = 1;
/** The steps that bring the setting in older formats to the current one, one per format (see {@link migrate}). */
const MERGE_MIGRATIONS: readonly Migration[] = [];

interface MergeValue {
  readonly format: typeof MERGE_FORMAT;
  readonly enabled: boolean;
}

/**
 * Whether keys next to each other of the same color merge into one piece, as the player set it on the settings page:
 * they do unless they turned it off. Kept with the player's data, and on until it's read from there.
 */
@Service()
export class MergeSetting {
  private readonly store = inject(RunStore);
  private readonly isEnabled = signal(true);

  readonly enabled = this.isEnabled.asReadonly();
  /** Settles once the stored setting has been read. */
  readonly loaded: Promise<void>;
  private changed = false;

  constructor() {
    this.loaded = this.store.setting(MERGE).then((stored) => {
      // Unless it was changed in the meantime.
      if (!this.changed) {
        this.isEnabled.set(parseSetting(stored));
      }
    });
  }

  /** Reads the stored setting again, once something else changed it, such as restoring a backup. */
  async reload(): Promise<void> {
    this.isEnabled.set(parseSetting(await this.store.setting(MERGE)));
  }

  /** Turns merging on or off, and keeps it that way for the next visits. */
  async set(enabled: boolean): Promise<void> {
    this.changed = true;
    this.isEnabled.set(enabled);
    const setting: MergeValue = { format: MERGE_FORMAT, enabled };
    await this.store.saveSetting(MERGE, setting);
  }
}

/** Whether a stored setting leaves merging on. A setting in a format this version doesn't know leaves it on. */
function parseSetting(stored: unknown): boolean {
  if (typeof stored !== 'object' || stored === null) {
    return true;
  }
  const { format, enabled } = migrate(stored, MERGE_MIGRATIONS);
  return format !== MERGE_FORMAT || enabled !== false;
}
