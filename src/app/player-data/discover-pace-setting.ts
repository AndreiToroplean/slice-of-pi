import { inject, Service, signal } from '@angular/core';
import { DEFAULT_DISCOVER_PACE, DiscoverPace, isDiscoverPace } from '../game/modes/discover-pace';
import { migrate, Migration } from './migration';
import { RunStore } from './run-store';

/** The name of the Discover pace setting in the store. */
export const DISCOVER_PACE = 'discover-pace';
/** The format of the stored setting, which changes, with a migration, whenever the setting does. */
export const DISCOVER_PACE_FORMAT = 1;
/** The steps that bring the setting in older formats to the current one, one per format (see {@link migrate}). */
const DISCOVER_PACE_MIGRATIONS: readonly Migration[] = [];

interface DiscoverPaceValue {
  readonly format: typeof DISCOVER_PACE_FORMAT;
  readonly pace: DiscoverPace;
}

/**
 * How fast the game plays each round of Discover, as the player picked it on the settings page. Kept with the player's
 * data, and the medium pace until it's read from there.
 */
@Service()
export class DiscoverPaceSetting {
  private readonly store = inject(RunStore);
  private readonly picked = signal<DiscoverPace>(DEFAULT_DISCOVER_PACE);

  readonly pace = this.picked.asReadonly();
  /** Settles once the stored setting has been read. */
  readonly loaded: Promise<void>;
  private changed = false;

  constructor() {
    this.loaded = this.store.setting(DISCOVER_PACE).then((stored) => {
      // Unless it was changed in the meantime.
      if (!this.changed) {
        this.picked.set(parseSetting(stored));
      }
    });
  }

  /** Reads the stored setting again, once something else changed it, such as restoring a backup. */
  async reload(): Promise<void> {
    this.picked.set(parseSetting(await this.store.setting(DISCOVER_PACE)));
  }

  /** Picks the pace, and keeps it for the next visits. */
  async set(pace: DiscoverPace): Promise<void> {
    this.changed = true;
    this.picked.set(pace);
    const setting: DiscoverPaceValue = { format: DISCOVER_PACE_FORMAT, pace };
    await this.store.saveSetting(DISCOVER_PACE, setting);
  }
}

/** The pace a stored setting picks. A setting in a format this version doesn't know picks the medium one. */
function parseSetting(stored: unknown): DiscoverPace {
  if (typeof stored !== 'object' || stored === null) {
    return DEFAULT_DISCOVER_PACE;
  }
  const { format, pace } = migrate(stored, DISCOVER_PACE_MIGRATIONS);
  return format === DISCOVER_PACE_FORMAT && isDiscoverPace(pace) ? pace : DEFAULT_DISCOVER_PACE;
}
