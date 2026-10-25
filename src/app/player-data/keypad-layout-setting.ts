import { inject, Service, signal } from '@angular/core';
import { DEFAULT_KEYPAD_LAYOUT, KEYPAD_LAYOUTS, KeypadLayout } from '../game/layers/keypad-layout';
import { migrate, Migration } from './migration';
import { RunStore } from './run-store';

/** The name of the keypad layout setting in the store. */
export const KEYPAD_LAYOUT = 'keypad-layout';
/** The format of the stored setting, which changes, with a migration, whenever the setting does. */
export const KEYPAD_LAYOUT_FORMAT = 1;
/** The steps that bring the setting in older formats to the current one, one per format (see {@link migrate}). */
const KEYPAD_LAYOUT_MIGRATIONS: readonly Migration[] = [];

interface KeypadLayoutValue {
  readonly format: typeof KEYPAD_LAYOUT_FORMAT;
  readonly layout: KeypadLayout;
}

/**
 * The keypad layout the player picked, on the settings page. Kept with the player's data, and the default layout until
 * it's read from there.
 */
@Service()
export class KeypadLayoutSetting {
  private readonly store = inject(RunStore);
  private readonly picked = signal<KeypadLayout>(DEFAULT_KEYPAD_LAYOUT);

  readonly layout = this.picked.asReadonly();
  /** Settles once the stored setting has been read. */
  readonly loaded: Promise<void>;
  private changed = false;

  constructor() {
    this.loaded = this.store.setting(KEYPAD_LAYOUT).then((stored) => {
      // Unless it was changed in the meantime.
      if (!this.changed) {
        this.picked.set(parseSetting(stored));
      }
    });
  }

  /** Reads the stored setting again, once something else changed it, such as restoring a backup. */
  async reload(): Promise<void> {
    this.picked.set(parseSetting(await this.store.setting(KEYPAD_LAYOUT)));
  }

  /** Picks the keypad layout, and keeps it for the next visits. */
  async set(layout: KeypadLayout): Promise<void> {
    this.changed = true;
    this.picked.set(layout);
    const setting: KeypadLayoutValue = { format: KEYPAD_LAYOUT_FORMAT, layout };
    await this.store.saveSetting(KEYPAD_LAYOUT, setting);
  }
}

/** The layout a stored setting picks. A setting in a format this version doesn't know picks the default one. */
function parseSetting(stored: unknown): KeypadLayout {
  if (typeof stored !== 'object' || stored === null) {
    return DEFAULT_KEYPAD_LAYOUT;
  }
  const { format, layout } = migrate(stored, KEYPAD_LAYOUT_MIGRATIONS);
  return format === KEYPAD_LAYOUT_FORMAT
    ? (KEYPAD_LAYOUTS.find((each) => each === layout) ?? DEFAULT_KEYPAD_LAYOUT)
    : DEFAULT_KEYPAD_LAYOUT;
}
