import { inject, Service, signal } from '@angular/core';
import {
  DEFAULT_DISCOVERY_PACE,
  DiscoveryPace,
  isDiscoveryPace,
} from '../game/modes/discovery-pace';
import { migrate, Migration } from './migration';
import { RunStore } from './run-store';

/** The name of the Discovery pace setting in the store: the mode's name before it became Discovery, kept as it's saved. */
export const DISCOVERY_PACE = 'discover-pace';
/** The format of the stored setting, which changes, with a migration, whenever the setting does. */
export const DISCOVERY_PACE_FORMAT = 1;
/** The steps that bring the setting in older formats to the current one, one per format (see {@link migrate}). */
const DISCOVERY_PACE_MIGRATIONS: readonly Migration[] = [];

interface DiscoveryPaceValue {
  readonly format: typeof DISCOVERY_PACE_FORMAT;
  readonly pace: DiscoveryPace;
}

/**
 * How fast the game plays each round of Discovery, as the player picked it on the settings page. Kept with the player's
 * data, and the medium pace until it's read from there.
 */
@Service()
export class DiscoveryPaceSetting {
  private readonly store = inject(RunStore);
  private readonly picked = signal<DiscoveryPace>(DEFAULT_DISCOVERY_PACE);

  readonly pace = this.picked.asReadonly();
  /** Settles once the stored setting has been read. */
  readonly loaded: Promise<void>;
  private changed = false;

  constructor() {
    this.loaded = this.store.setting(DISCOVERY_PACE).then((stored) => {
      // Unless it was changed in the meantime.
      if (!this.changed) {
        this.picked.set(parseSetting(stored));
      }
    });
  }

  /** Reads the stored setting again, once something else changed it, such as restoring a backup. */
  async reload(): Promise<void> {
    this.picked.set(parseSetting(await this.store.setting(DISCOVERY_PACE)));
  }

  /** Picks the pace, and keeps it for the next visits. */
  async set(pace: DiscoveryPace): Promise<void> {
    this.changed = true;
    this.picked.set(pace);
    const setting: DiscoveryPaceValue = { format: DISCOVERY_PACE_FORMAT, pace };
    await this.store.saveSetting(DISCOVERY_PACE, setting);
  }
}

/** The pace a stored setting picks. A setting in a format this version doesn't know picks the medium one. */
function parseSetting(stored: unknown): DiscoveryPace {
  if (typeof stored !== 'object' || stored === null) {
    return DEFAULT_DISCOVERY_PACE;
  }
  const { format, pace } = migrate(stored, DISCOVERY_PACE_MIGRATIONS);
  return format === DISCOVERY_PACE_FORMAT && isDiscoveryPace(pace) ? pace : DEFAULT_DISCOVERY_PACE;
}
