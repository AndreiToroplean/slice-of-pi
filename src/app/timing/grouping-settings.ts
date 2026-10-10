import { Service, signal } from '@angular/core';
import { DEFAULT_TIMING_SETTINGS, TimingSettings } from './timing-model';

/** The settings of the timing model in use, which the player's data page lets the player tweak while trying them out. */
@Service()
export class GroupingSettings {
  readonly settings = signal<TimingSettings>(DEFAULT_TIMING_SETTINGS);
}
