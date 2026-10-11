import { inject, Service, signal } from '@angular/core';
import { RunStore } from '../runs/run-store';

/** The name of the developer mode setting in the store. */
export const DEVELOPER_MODE = 'developer-mode';
/** The format of the stored setting, which changes, with a migration, whenever the setting does (`architecture.md` §5). */
export const DEVELOPER_MODE_FORMAT = 1;

interface DeveloperModeSetting {
  readonly format: typeof DEVELOPER_MODE_FORMAT;
  readonly enabled: boolean;
}

/**
 * Whether developer mode is on: a hidden mode, turned on and off with a secret gesture on the main menu, that will open
 * pages to tune the game. It isn't a security feature, only out of the way of players. Kept with the player's data, and
 * off until it's read from there.
 */
@Service()
export class DeveloperMode {
  private readonly store = inject(RunStore);
  private readonly isEnabled = signal(false);

  readonly enabled = this.isEnabled.asReadonly();
  /** Settles once the stored setting has been read. */
  readonly loaded: Promise<void>;
  private changed = false;

  constructor() {
    this.loaded = this.store.setting(DEVELOPER_MODE).then((stored) => {
      // Unless it was turned on or off in the meantime.
      if (!this.changed) {
        this.isEnabled.set(parseSetting(stored));
      }
    });
  }

  /** Reads the stored setting again, once something else changed it, such as restoring a backup. */
  async reload(): Promise<void> {
    this.isEnabled.set(parseSetting(await this.store.setting(DEVELOPER_MODE)));
  }

  /** Turns developer mode on or off, and keeps it that way for the next visits. */
  async set(enabled: boolean): Promise<void> {
    this.changed = true;
    this.isEnabled.set(enabled);
    const setting: DeveloperModeSetting = { format: DEVELOPER_MODE_FORMAT, enabled };
    await this.store.saveSetting(DEVELOPER_MODE, setting);
  }
}

/** Whether a stored setting turns developer mode on. A setting in a format this version doesn't know leaves it off. */
function parseSetting(stored: unknown): boolean {
  return (
    typeof stored === 'object' &&
    stored !== null &&
    'format' in stored &&
    stored.format === DEVELOPER_MODE_FORMAT &&
    'enabled' in stored &&
    stored.enabled === true
  );
}
