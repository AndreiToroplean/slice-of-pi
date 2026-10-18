import { Component, inject } from '@angular/core';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { KeypadLayout } from '../../game/layers/keypad-layout';
import { KeypadLayoutSetting } from '../../player-data/keypad-layout-setting';
import { Page } from '../../ui/page';
import { Segment, Segmented } from '../../ui/segmented';

/**
 * The game's settings, opened from the main menu's gear: the keypad's layout, and in developer mode, whether to count
 * down to the end of each group.
 */
@Component({
  selector: 'app-settings',
  imports: [Page, Segmented],
  template: `
    <app-page title="Settings">
      <section class="panel" aria-labelledby="keypad-title">
        <h2 id="keypad-title">Keypad</h2>
        <app-segmented
          label="Keypad layout"
          [segments]="layouts"
          [value]="keypadLayout.layout()"
          (valueChange)="keypadLayout.set($event)"
        />
      </section>
      @if (developerMode.enabled()) {
        <section class="panel" aria-labelledby="developer-title">
          <h2 id="developer-title">Developer</h2>
          <label class="setting">
            <span>
              Countdown
              <small>Left of 0, the seconds until the group being typed ends.</small>
            </span>
            <input type="checkbox" [checked]="tweaks.countdown()" (change)="setCountdown($event)" />
          </label>
        </section>
      }
    </app-page>
  `,
  styleUrl: './settings.css',
})
export class Settings {
  protected readonly keypadLayout = inject(KeypadLayoutSetting);
  protected readonly layouts: readonly Segment<KeypadLayout>[] = [
    { value: 'calculator', label: 'Calculator' },
    { value: 'telephone', label: 'Telephone' },
  ];
  protected readonly developerMode = inject(DeveloperMode);
  protected readonly tweaks = inject(Tweaks);

  protected setCountdown(event: Event): void {
    void this.tweaks.setCountdown((event.target as HTMLInputElement).checked);
  }
}
