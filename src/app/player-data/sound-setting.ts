import { inject, Service, signal } from '@angular/core';
import { migrate, Migration } from './migration';
import { RunStore } from './run-store';

/** The name of the sound setting in the store. */
export const SOUND = 'sound';
/** The format of the stored setting, which changes, with a migration, whenever the setting does. */
export const SOUND_FORMAT = 1;
/** The steps that bring the setting in older formats to the current one, one per format (see {@link migrate}). */
const SOUND_MIGRATIONS: readonly Migration[] = [];

interface SoundValue {
  readonly format: typeof SOUND_FORMAT;
  readonly enabled: boolean;
}

/**
 * Whether the game plays sounds, as the player set it on the settings page: it does unless they turned them off. Kept with
 * the player's data, and on until it's read from there.
 */
@Service()
export class SoundSetting {
  private readonly store = inject(RunStore);
  private readonly isEnabled = signal(true);

  readonly enabled = this.isEnabled.asReadonly();
  /** Settles once the stored setting has been read. */
  readonly loaded: Promise<void>;
  private changed = false;

  constructor() {
    this.loaded = this.store.setting(SOUND).then((stored) => {
      // Unless it was changed in the meantime.
      if (!this.changed) {
        this.isEnabled.set(parseSetting(stored));
      }
    });
  }

  /** Reads the stored setting again, once something else changed it, such as restoring a backup. */
  async reload(): Promise<void> {
    this.isEnabled.set(parseSetting(await this.store.setting(SOUND)));
  }

  /** Turns sounds on or off, and keeps it that way for the next visits. */
  async set(enabled: boolean): Promise<void> {
    this.changed = true;
    this.isEnabled.set(enabled);
    const setting: SoundValue = { format: SOUND_FORMAT, enabled };
    await this.store.saveSetting(SOUND, setting);
  }
}

/** Whether a stored setting leaves sounds on. A setting in a format this version doesn't know leaves it on. */
function parseSetting(stored: unknown): boolean {
  if (typeof stored !== 'object' || stored === null) {
    return true;
  }
  const { format, enabled } = migrate(stored, SOUND_MIGRATIONS);
  return format !== SOUND_FORMAT || enabled !== false;
}
