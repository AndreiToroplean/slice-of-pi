import { inject } from '@angular/core';
import { DeveloperMode } from '../developer-mode/developer-mode';
import { Tweaks } from '../developer-mode/tweaks';
import { DiscoverPaceSetting } from './discover-pace-setting';
import { GroupSizeSetting } from './group-size-setting';
import { KeypadLayoutSetting } from './keypad-layout-setting';
import { RunStore } from './run-store';
import { SoundSetting } from './sound-setting';
import { VibrationSetting } from './vibration-setting';

/**
 * Reads the player's data, the runs and every setting, before the app shows anything: every screen then shows it from
 * the start, never the defaults first, nor a choice sliding over to the player's as it arrives.
 */
export async function loadPlayerData(): Promise<void> {
  await Promise.all([
    inject(RunStore).loaded,
    inject(DeveloperMode).loaded,
    inject(Tweaks).loaded,
    inject(KeypadLayoutSetting).loaded,
    inject(DiscoverPaceSetting).loaded,
    inject(GroupSizeSetting).loaded,
    inject(VibrationSetting).loaded,
    inject(SoundSetting).loaded,
  ]);
}
