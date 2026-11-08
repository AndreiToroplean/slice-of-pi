import { Component, computed, inject, viewChild } from '@angular/core';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { DEFAULT_KEYPAD_LAYOUT, KeypadLayout } from '../../game/layers/keypad-layout';
import { KeypadLayoutSetting } from '../../player-data/keypad-layout-setting';
import { Slider } from '../../ui/slider';
import { KEY_LINGER, MAX_KEY_LINGER } from '../../game/layers/place-colors';
import { DiscoverPaceSetting } from '../../player-data/discover-pace-setting';
import { DEFAULT_DISCOVER_PACE, DiscoverPace } from '../../game/modes/discover-pace';
import { VibrationSetting } from '../../player-data/vibration-setting';
import { SoundSetting } from '../../player-data/sound-setting';
import { Page } from '../../ui/page';
import { Segment, Segmented } from '../../ui/segmented';
import { ButtonList } from '../../ui/button-list';
import { ChoiceDialog } from '../../ui/choice-dialog';
import { Candy } from '../../ui/candy';
import { YourData } from './your-data';

/**
 * The game's settings, opened from the main menu's gear: the player's data, the keypad's layout, Discover's pace, whether the game
 * plays sounds and the phone vibrates, and in developer mode,
 * whether the keys are solid or see-through, whether to count down to the end of each group, whether to show what each
 * key typed played, and whether to leave the
 * digits typed unchecked. Each setting has a button to
 * bring back its default value, and the top bar one to bring them all back. In developer mode, a last button brings back
 * the game's own value of every tweak, once confirmed.
 */
@Component({
  selector: 'app-settings',
  imports: [ButtonList, Candy, ChoiceDialog, Page, Segmented, YourData, Slider],
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
      <section class="panel" aria-labelledby="discover-title">
        <h2 id="discover-title">Discover</h2>
        <div class="row">
          <app-segmented
            label="Discover pace"
            [segments]="paces"
            [value]="discoverPace.pace()"
            (valueChange)="discoverPace.set($event)"
          />
          <button
            type="button"
            class="round"
            title="Back to Default"
            [disabled]="paceDefault()"
            (click)="resetPace()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </svg>
          </button>
        </div>
      </section>
      <section class="panel" aria-labelledby="feel-title">
        <h2 id="feel-title">Feel</h2>
        <div class="row">
          <label class="setting">
            <span>
              Sound
              <small>A note for each digit typed, and a chord as each word lands.</small>
            </span>
            <input type="checkbox" [checked]="sound.enabled()" (change)="setSound($event)" />
          </label>
          <button
            type="button"
            class="round"
            title="Back to Default"
            [disabled]="sound.enabled()"
            (click)="resetSound()"
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
              Vibration
              <small>A buzz for each tap, and as each digit flies to the tape.</small>
            </span>
            <input
              type="checkbox"
              [checked]="vibration.enabled()"
              (change)="setVibration($event)"
            />
          </label>
          <button
            type="button"
            class="round"
            title="Back to Default"
            [disabled]="vibration.enabled()"
            (click)="resetVibration()"
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
          <app-slider
            label="Key Linger"
            [value]="tweaks.keyLinger()"
            [min]="0"
            [max]="maxKeyLinger"
            [step]="10"
            [valueText]="tweaks.keyLinger() + ' ms'"
            [defaultValue]="defaultKeyLinger"
            (changed)="setKeyLinger($event)"
          />
          <div class="row">
            <label class="setting">
              <span>
                Countdown
                <small
                  >In the top right corner, the seconds until the group being typed ends.</small
                >
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
                Sound Notes
                <small>A line for each note played, during the game.</small>
              </span>
              <input
                type="checkbox"
                [checked]="tweaks.soundNotes()"
                (change)="setSoundNotes($event)"
              />
            </label>
            <button
              type="button"
              class="round"
              title="Back to Default"
              [disabled]="!tweaks.soundNotes()"
              (click)="resetSoundNotes()"
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
                Don’t Check Digits
                <small
                  >Any digit goes, to try things out; otherwise a wrong digit is a mistake.</small
                >
              </span>
              <input
                type="checkbox"
                [checked]="!tweaks.checking()"
                (change)="setUnchecked($event)"
              />
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
          <app-button-list>
            <button
              type="button"
              appCandy="danger"
              aria-haspopup="dialog"
              [disabled]="untuned()"
              (click)="resetTweaksDialog.open()"
            >
              Reset All Tweaks
            </button>
          </app-button-list>
        </section>
      }
      <app-choice-dialog #resetTweaksDialog heading="Reset the Tweaks?">
        <p>
          Everything tuned in developer mode goes back to the game’s own values: colors, break
          models, layout, run order and these settings. Only a backup file can bring them back.
        </p>
        <button type="button" appCandy (click)="void resetTweaksDialog.close()">Back</button>
        <button type="button" appCandy="danger" (click)="resetTweaks()">Reset All Tweaks</button>
      </app-choice-dialog>
    </app-page>
  `,
  styleUrl: './settings.css',
})
export class Settings {
  protected readonly keypadLayout = inject(KeypadLayoutSetting);
  protected readonly vibration = inject(VibrationSetting);
  protected readonly sound = inject(SoundSetting);
  protected readonly layouts: readonly Segment<KeypadLayout>[] = [
    { value: 'calculator', label: 'Calculator' },
    { value: 'telephone', label: 'Telephone' },
  ];
  protected readonly maxKeyLinger = MAX_KEY_LINGER;
  protected readonly defaultKeyLinger = KEY_LINGER;
  protected readonly discoverPace = inject(DiscoverPaceSetting);
  protected readonly paces: readonly Segment<DiscoverPace>[] = [
    { value: 'slower', label: 'Slower' },
    { value: 'medium', label: 'Medium' },
    { value: 'faster', label: 'Faster' },
  ];
  protected readonly keyLooks: readonly Segment<'clear' | 'solid'>[] = [
    { value: 'clear', label: 'Clear Keys' },
    { value: 'solid', label: 'Solid Keys' },
  ];
  protected readonly developerMode = inject(DeveloperMode);
  protected readonly tweaks = inject(Tweaks);
  private readonly resetTweaksDialog = viewChild.required<ChoiceDialog>('resetTweaksDialog');

  /** Whether nothing is tuned in developer mode. */
  protected readonly untuned = computed(() => Object.keys(this.tweaks.values()).length === 0);

  protected readonly layoutDefault = computed(
    () => this.keypadLayout.layout() === DEFAULT_KEYPAD_LAYOUT,
  );
  protected readonly paceDefault = computed(
    () => this.discoverPace.pace() === DEFAULT_DISCOVER_PACE,
  );
  /** Whether the countdown is hidden, as it is unless turned on: only developer mode has it. */
  protected readonly countdownDefault = computed(() => !this.tweaks.countdown());
  /** Whether every setting shown has its default value; the digits are always checked outside developer mode. */
  protected readonly allDefault = computed(
    () =>
      this.layoutDefault() &&
      this.paceDefault() &&
      this.vibration.enabled() &&
      this.sound.enabled() &&
      this.countdownDefault() &&
      !this.tweaks.soundNotes() &&
      this.tweaks.checking() &&
      !this.tweaks.solidKeys() &&
      this.tweaks.keyLinger() === KEY_LINGER,
  );

  protected setCountdown(event: Event): void {
    void this.tweaks.setCountdown((event.target as HTMLInputElement).checked);
  }

  protected setKeyLinger(linger: number | undefined): void {
    void this.tweaks.setKeyLinger(linger);
  }

  protected setSolidKeys(solid: boolean): void {
    void this.tweaks.setSolidKeys(solid);
  }

  protected setUnchecked(event: Event): void {
    void this.tweaks.setChecking(!(event.target as HTMLInputElement).checked);
  }

  protected setVibration(event: Event): void {
    void this.vibration.set((event.target as HTMLInputElement).checked);
  }

  protected resetVibration(): void {
    void this.vibration.set(true);
  }

  protected resetPace(): void {
    void this.discoverPace.set(DEFAULT_DISCOVER_PACE);
  }

  protected setSound(event: Event): void {
    void this.sound.set((event.target as HTMLInputElement).checked);
  }

  protected resetSound(): void {
    void this.sound.set(true);
  }

  protected resetLayout(): void {
    void this.keypadLayout.set(DEFAULT_KEYPAD_LAYOUT);
  }

  protected setSoundNotes(event: Event): void {
    void this.tweaks.setSoundNotes((event.target as HTMLInputElement).checked);
  }

  protected resetSoundNotes(): void {
    void this.tweaks.setSoundNotes(false);
  }

  protected resetCountdown(): void {
    void this.tweaks.setCountdown(false);
  }

  protected resetChecking(): void {
    void this.tweaks.setChecking(true);
  }

  /** Brings back the game's own value of every tweak, once confirmed. */
  protected resetTweaks(): void {
    void this.resetTweaksDialog().close();
    void this.tweaks.reset();
  }

  /** Brings back the default value of every setting shown. */
  protected resetAll(): void {
    this.resetLayout();
    this.resetPace();
    this.resetVibration();
    this.resetSound();
    if (this.developerMode.enabled()) {
      this.setSolidKeys(false);
      this.setKeyLinger(undefined);
      this.resetCountdown();
      this.resetSoundNotes();
      this.resetChecking();
    }
  }
}
