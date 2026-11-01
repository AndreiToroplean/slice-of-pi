import { inject, Service, signal } from '@angular/core';
import { migrate, Migration } from './migration';
import { RunStore } from './run-store';

/** The name of the vibration setting in the store. */
export const VIBRATION = 'vibration';
/** The format of the stored setting, which changes, with a migration, whenever the setting does. */
export const VIBRATION_FORMAT = 1;
/** The steps that bring the setting in older formats to the current one, one per format (see {@link migrate}). */
const VIBRATION_MIGRATIONS: readonly Migration[] = [];

interface VibrationValue {
  readonly format: typeof VIBRATION_FORMAT;
  readonly enabled: boolean;
}

/**
 * Whether the phone vibrates, as the player set it on the settings page: it does unless they turned it off. Kept with
 * the player's data, and on until it's read from there.
 */
@Service()
export class VibrationSetting {
  private readonly store = inject(RunStore);
  private readonly isEnabled = signal(true);

  readonly enabled = this.isEnabled.asReadonly();
  /** Settles once the stored setting has been read. */
  readonly loaded: Promise<void>;
  private changed = false;

  constructor() {
    this.loaded = this.store.setting(VIBRATION).then((stored) => {
      // Unless it was changed in the meantime.
      if (!this.changed) {
        this.isEnabled.set(parseSetting(stored));
      }
    });
  }

  /** Reads the stored setting again, once something else changed it, such as restoring a backup. */
  async reload(): Promise<void> {
    this.isEnabled.set(parseSetting(await this.store.setting(VIBRATION)));
  }

  /** Turns vibration on or off, and keeps it that way for the next visits. */
  async set(enabled: boolean): Promise<void> {
    this.changed = true;
    this.isEnabled.set(enabled);
    const setting: VibrationValue = { format: VIBRATION_FORMAT, enabled };
    await this.store.saveSetting(VIBRATION, setting);
  }
}

/** Whether a stored setting leaves vibration on. A setting in a format this version doesn't know leaves it on. */
function parseSetting(stored: unknown): boolean {
  if (typeof stored !== 'object' || stored === null) {
    return true;
  }
  const { format, enabled } = migrate(stored, VIBRATION_MIGRATIONS);
  return format !== VIBRATION_FORMAT || enabled !== false;
}
