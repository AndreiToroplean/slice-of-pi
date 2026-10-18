import { Component, inject } from '@angular/core';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { Page } from '../../ui/page';

/** The game's settings, opened from the main menu's gear: in developer mode, whether to count down to group ends. */
@Component({
  selector: 'app-settings',
  imports: [Page],
  template: `
    <app-page title="Settings">
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
  protected readonly developerMode = inject(DeveloperMode);
  protected readonly tweaks = inject(Tweaks);

  protected setCountdown(event: Event): void {
    void this.tweaks.setCountdown((event.target as HTMLInputElement).checked);
  }
}
