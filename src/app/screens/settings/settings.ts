import { Component, computed, inject } from '@angular/core';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { DEFAULT_KEYPAD_LAYOUT, KeypadLayout } from '../../game/layers/keypad-layout';
import { KeypadLayoutSetting } from '../../player-data/keypad-layout-setting';
import { Page } from '../../ui/page';
import { Segment, Segmented } from '../../ui/segmented';
import { Candy } from '../../ui/candy';
import { YourData } from './your-data';

/**
 * The game's settings, opened from the main menu's gear: the player's data, the keypad's layout, and in developer mode,
 * whether the keys are see-through or solid, whether to count down to the end of each group and whether to check the
 * digits typed. Each setting has a button to
 * bring back its default value, and the top bar one to bring them all back.
 */
@Component({
  selector: 'app-settings',
  imports: [Candy, Page, Segmented, YourData],
  template: `
    <app-page heading="Settings">
      <button
        pageAction
        type="button"
        appCandy="danger"
        [disabled]="allDefault()"
        (click)="resetAll()"
      >
        Reset Settings
      </button>
      <app-your-data />
      <section class="panel" aria-labelledby="keypad-title">
        <h2 id="keypad-title">Keypad</h2>
        <div class="row">
          <app-segmented
            label="Keypad layout"
            [segments]="layouts"
            [value]="keypadLayout.layout()"
            (valueChange)="keypadLayout.set($event)"
          />
          <button
            type="button"
            class="round"
            title="Back to Default"
            [disabled]="layoutDefault()"
            (click)="resetLayout()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </svg>
          </button>
        </div>
      </section>
      @if (developerMode.enabled()) {
        <section class="panel" aria-labelledby="developer-title">
          <h2 id="developer-title">Developer</h2>
          <div class="row">
            <app-segmented
              label="Keys"
              [segments]="keyLooks"
              [value]="tweaks.solidKeys() ? 'solid' : 'clear'"
              (valueChange)="setSolidKeys($event === 'solid')"
            />
            <button
              type="button"
              class="round"
              title="Back to Default"
              [disabled]="!tweaks.solidKeys()"
              (click)="setSolidKeys(false)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
              </svg>
            </button>
          </div>
          <div class="row">
            <label class="setting">
              <span>
                Countdown
                <small>Left of 0, the seconds until the group being typed ends.</small>
              </span>
              <input
                type="checkbox"
                [checked]="tweaks.countdown()"
                (change)="setCountdown($event)"
              />
            </label>
            <button
              type="button"
              class="round"
              title="Back to Default"
              [disabled]="countdownDefault()"
              (click)="resetCountdown()"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
              </svg>
            </button>
          </div>
          <div class="row">
            <label class="setting">
              <span>
                Check Digits
                <small>A wrong digit is a mistake; off, any digit goes, to try things out.</small>
              </span>
              <input type="checkbox" [checked]="tweaks.checking()" (change)="setChecking($event)" />
            </label>
            <button
              type="button"
              class="round"
              title="Back to Default"
              [disabled]="tweaks.checking()"
              (click)="resetChecking()"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
              </svg>
            </button>
          </div>
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
  protected readonly keyLooks: readonly Segment<'clear' | 'solid'>[] = [
    { value: 'clear', label: 'Clear Keys' },
    { value: 'solid', label: 'Solid Keys' },
  ];
  protected readonly developerMode = inject(DeveloperMode);
  protected readonly tweaks = inject(Tweaks);

  protected readonly layoutDefault = computed(
    () => this.keypadLayout.layout() === DEFAULT_KEYPAD_LAYOUT,
  );
  /** Whether the countdown shows, as it does unless turned off: only developer mode has it. */
  protected readonly countdownDefault = computed(
    () => !this.developerMode.enabled() || this.tweaks.countdown(),
  );
  /** Whether every setting shown has its default value; the digits are always checked outside developer mode. */
  protected readonly allDefault = computed(
    () =>
      this.layoutDefault() &&
      this.countdownDefault() &&
      this.tweaks.checking() &&
      !this.tweaks.solidKeys(),
  );

  protected setCountdown(event: Event): void {
    void this.tweaks.setCountdown((event.target as HTMLInputElement).checked);
  }

  protected setSolidKeys(solid: boolean): void {
    void this.tweaks.setSolidKeys(solid);
  }

  protected setChecking(event: Event): void {
    void this.tweaks.setChecking((event.target as HTMLInputElement).checked);
  }

  protected resetLayout(): void {
    void this.keypadLayout.set(DEFAULT_KEYPAD_LAYOUT);
  }

  protected resetCountdown(): void {
    void this.tweaks.setCountdown(true);
  }

  protected resetChecking(): void {
    void this.tweaks.setChecking(true);
  }

  /** Brings back the default value of every setting shown. */
  protected resetAll(): void {
    this.resetLayout();
    if (this.developerMode.enabled()) {
      this.setSolidKeys(false);
      this.resetCountdown();
      this.resetChecking();
    }
  }
}
