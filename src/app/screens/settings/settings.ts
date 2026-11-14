import { Component, computed, inject, viewChild } from '@angular/core';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { DEFAULT_KEYPAD_LAYOUT, KeypadLayout } from '../../game/layers/keypad-layout';
import { KeypadLayoutSetting } from '../../player-data/keypad-layout-setting';
import { Slider } from '../../ui/slider';
import { Spinner } from '../../ui/spinner';
import { GroupSizeSetting } from '../../player-data/group-size-setting';
import { DEFAULT_GROUP_SIZE, GROUP_SIZES } from '../../game/grouping/group-size';
import { BREATH, MAX_BREATH } from '../../ui/breath';
import { UNAVAILABLE } from '../../ui/unavailable';
import { CHECKPOINT_LAG, MAX_CHECKPOINT_LAG } from '../../game/modes/discovery-rounds';
import { DiscoveryPaceSetting } from '../../player-data/discovery-pace-setting';
import {
  DEFAULT_DISCOVERY_PACE,
  DISCOVERY_SPEED,
  DISCOVERY_SPEEDS,
  DiscoveryPace,
  MAX_PACE_STEP,
  FAST_FORWARD,
  FAINT_OPACITY,
  GROUP_PAUSE,
  HAND_OVER,
  MAX_FAST_FORWARD,
  MIN_FAINT_OPACITY,
  MAX_GROUP_PAUSE,
  MAX_HAND_OVER,
  PACE_STEP,
} from '../../game/modes/discovery-pace';
import { VibrationSetting } from '../../player-data/vibration-setting';
import { MergeSetting } from '../../player-data/merge-setting';
import { SoundSetting } from '../../player-data/sound-setting';
import { Page } from '../../ui/page';
import { Segment, Segmented } from '../../ui/segmented';
import { ButtonList } from '../../ui/button-list';
import { ChoiceDialog } from '../../ui/choice-dialog';
import { Candy } from '../../ui/candy';
import { YourData } from './your-data';

/**
 * The game's settings, opened from the main menu's gear: the player's data, the keypad's layout and whether its keys of
 * the same color merge, Discovery's pace, whether the game
 * plays sounds and the phone vibrates, and in developer mode,
 * whether the keys are solid or see-through, whether to count down to the end of each group, whether to show what each
 * key typed played, and whether to leave the
 * digits typed unchecked. Each setting has a button to
 * bring back its default value, and the top bar one to bring them all back. In developer mode, a last button brings back
 * the game's own value of every tweak, once confirmed.
 */
@Component({
  selector: 'app-settings',
  imports: [ButtonList, Candy, ChoiceDialog, Page, Segmented, Slider, Spinner, YourData],
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
        <div class="row">
          <label class="setting">
            <span>
              Merge Keys
              <small>Keys side by side of the same color join into one.</small>
            </span>
            <input type="checkbox" [checked]="merge.enabled()" (change)="setMerge($event)" />
          </label>
          <button
            type="button"
            class="round"
            title="Back to Default"
            [disabled]="merge.enabled()"
            (click)="resetMerge()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </svg>
          </button>
        </div>
      </section>
      <section class="panel" aria-labelledby="groups-title">
        <h2 id="groups-title">Groups</h2>
        <div class="row">
          <div class="setting">
            <span>
              Group Size
              <small>The slots a group starts with, until the game knows your own groups.</small>
            </span>
            <app-spinner
              label="Group size"
              [min]="groupSizes.min"
              [max]="groupSizes.max"
              [value]="groupSize.size()"
              (valueChange)="groupSize.set($event)"
            />
          </div>
          <button
            type="button"
            class="round"
            title="Back to Default"
            [disabled]="groupSizeDefault()"
            (click)="resetGroupSize()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </svg>
          </button>
        </div>
      </section>
      <section class="panel" aria-labelledby="discovery-title">
        <h2 id="discovery-title">Discovery</h2>
        <div class="row">
          <app-segmented
            label="Discovery pace"
            [segments]="paces"
            [value]="discoveryPace.pace()"
            (valueChange)="discoveryPace.set($event)"
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
            label="Breath"
            [value]="tweaks.breath()"
            [min]="0"
            [max]="maxBreath"
            [step]="0.5"
            [valueText]="tweaks.breath() + ' px'"
            [defaultValue]="defaultBreath"
            (changed)="setBreath($event)"
          />
          <app-slider
            label="Unavailable"
            [value]="tweaks.unavailable()"
            [min]="0"
            [max]="100"
            [step]="5"
            [valueText]="tweaks.unavailable() + '%'"
            [defaultValue]="defaultUnavailable"
            (changed)="setUnavailable($event)"
          />
          <app-slider
            label="Discovery Speed"
            [value]="tweaks.discoverySpeed()"
            [min]="speeds.min"
            [max]="speeds.max"
            [step]="0.1"
            [valueText]="tweaks.discoverySpeed() + ' digits/s'"
            [defaultValue]="defaultSpeed"
            (changed)="setDiscoverySpeed($event)"
          />
          <app-slider
            label="Pace Step"
            [value]="tweaks.paceStep()"
            [min]="0"
            [max]="maxPaceStep"
            [step]="5"
            [valueText]="'±' + tweaks.paceStep() + '%'"
            [defaultValue]="defaultPaceStep"
            (changed)="setPaceStep($event)"
          />
          <app-slider
            label="Group Pause"
            [value]="tweaks.groupPause()"
            [min]="0"
            [max]="maxGroupPause"
            [step]="5"
            [valueText]="'+' + tweaks.groupPause() + '%'"
            [defaultValue]="defaultGroupPause"
            (changed)="setGroupPause($event)"
          />
          <app-slider
            label="Hand Over"
            [value]="tweaks.handOver()"
            [min]="0"
            [max]="maxHandOver"
            [step]="100"
            [valueText]="tweaks.handOver() + ' ms'"
            [defaultValue]="defaultHandOver"
            (changed)="setHandOver($event)"
          />
          <app-slider
            label="Fast Forward"
            [value]="tweaks.fastForward()"
            [min]="1"
            [max]="maxFastForward"
            [step]="0.1"
            [valueText]="'×' + tweaks.fastForward()"
            [defaultValue]="defaultFastForward"
            (changed)="setFastForward($event)"
          />
          <app-slider
            label="Faint Digits"
            [value]="tweaks.faintOpacity()"
            [min]="minFaintOpacity"
            [max]="1"
            [step]="0.05"
            [valueText]="percent(tweaks.faintOpacity())"
            [defaultValue]="defaultFaintOpacity"
            (changed)="setFaintOpacity($event)"
          />
          <div class="row">
            <label class="setting">
              <span>
                Manual Checkpoints
                <small
                  >In Discovery, picked by tapping them, rather than reached by themselves.</small
                >
              </span>
              <input
                type="checkbox"
                [checked]="tweaks.manualCheckpoints()"
                (change)="setManualCheckpoints($event)"
              />
            </label>
            <button
              type="button"
              class="round"
              title="Back to Default"
              [disabled]="!tweaks.manualCheckpoints()"
              (click)="resetManualCheckpoints()"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
              </svg>
            </button>
          </div>
          @if (!tweaks.manualCheckpoints()) {
            <app-slider
              label="Checkpoint Lag"
              [value]="tweaks.checkpointLag()"
              [min]="0"
              [max]="maxCheckpointLag"
              [step]="1"
              [valueText]="tweaks.checkpointLag() + ' behind'"
              [defaultValue]="defaultCheckpointLag"
              (changed)="setCheckpointLag($event)"
            />
          }
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
  protected readonly merge = inject(MergeSetting);
  protected readonly sound = inject(SoundSetting);
  protected readonly layouts: readonly Segment<KeypadLayout>[] = [
    { value: 'calculator', label: 'Calculator' },
    { value: 'telephone', label: 'Telephone' },
  ];
  protected readonly defaultBreath = BREATH;
  protected readonly defaultUnavailable = UNAVAILABLE;
  protected readonly defaultCheckpointLag = CHECKPOINT_LAG;
  protected readonly maxCheckpointLag = MAX_CHECKPOINT_LAG;
  protected readonly maxBreath = MAX_BREATH;
  protected readonly groupSize = inject(GroupSizeSetting);
  protected readonly groupSizes = GROUP_SIZES;
  protected readonly discoveryPace = inject(DiscoveryPaceSetting);
  protected readonly paces: readonly Segment<DiscoveryPace>[] = [
    { value: 'slower', label: 'Slower' },
    { value: 'medium', label: 'Medium' },
    { value: 'faster', label: 'Faster' },
  ];
  protected readonly speeds = DISCOVERY_SPEEDS;
  protected readonly defaultSpeed = DISCOVERY_SPEED;
  protected readonly maxPaceStep = MAX_PACE_STEP;
  protected readonly defaultPaceStep = PACE_STEP;
  protected readonly maxHandOver = MAX_HAND_OVER;
  protected readonly defaultHandOver = HAND_OVER;
  protected readonly maxGroupPause = MAX_GROUP_PAUSE;
  protected readonly defaultGroupPause = GROUP_PAUSE;
  protected readonly maxFastForward = MAX_FAST_FORWARD;
  protected readonly defaultFastForward = FAST_FORWARD;
  protected readonly minFaintOpacity = MIN_FAINT_OPACITY;
  protected readonly defaultFaintOpacity = FAINT_OPACITY;
  protected readonly keyLooks: readonly Segment<'clear' | 'solid'>[] = [
    { value: 'clear', label: 'Clear Keys' },
    { value: 'solid', label: 'Solid Keys' },
  ];
  protected readonly developerMode = inject(DeveloperMode);
  protected readonly tweaks = inject(Tweaks);
  private readonly resetTweaksDialog = viewChild.required<ChoiceDialog>('resetTweaksDialog');

  /** Whether nothing is tuned in developer mode. */
  protected readonly untuned = computed(() => Object.keys(this.tweaks.values()).length === 0);

  protected readonly groupSizeDefault = computed(
    () => this.groupSize.size() === DEFAULT_GROUP_SIZE,
  );
  protected readonly layoutDefault = computed(
    () => this.keypadLayout.layout() === DEFAULT_KEYPAD_LAYOUT,
  );
  protected readonly paceDefault = computed(
    () => this.discoveryPace.pace() === DEFAULT_DISCOVERY_PACE,
  );
  /** Whether the countdown is hidden, as it is unless turned on: only developer mode has it. */
  protected readonly countdownDefault = computed(() => !this.tweaks.countdown());
  /** Whether every setting shown has its default value; the digits are always checked outside developer mode. */
  protected readonly allDefault = computed(
    () =>
      this.layoutDefault() &&
      this.merge.enabled() &&
      this.groupSizeDefault() &&
      this.paceDefault() &&
      this.vibration.enabled() &&
      this.sound.enabled() &&
      this.countdownDefault() &&
      !this.tweaks.soundNotes() &&
      this.tweaks.checking() &&
      !this.tweaks.solidKeys() &&
      this.tweaks.breath() === BREATH &&
      this.tweaks.unavailable() === UNAVAILABLE &&
      this.tweaks.discoverySpeed() === DISCOVERY_SPEED &&
      this.tweaks.paceStep() === PACE_STEP &&
      this.tweaks.handOver() === HAND_OVER &&
      this.tweaks.groupPause() === GROUP_PAUSE &&
      this.tweaks.fastForward() === FAST_FORWARD &&
      this.tweaks.faintOpacity() === FAINT_OPACITY &&
      !this.tweaks.manualCheckpoints() &&
      this.tweaks.checkpointLag() === CHECKPOINT_LAG,
  );

  protected setCountdown(event: Event): void {
    void this.tweaks.setCountdown((event.target as HTMLInputElement).checked);
  }

  protected setBreath(breath: number | undefined): void {
    void this.tweaks.setBreath(breath);
  }

  protected setUnavailable(unavailable: number | undefined): void {
    void this.tweaks.setUnavailable(unavailable);
  }

  protected setManualCheckpoints(event: Event): void {
    void this.tweaks.setManualCheckpoints((event.target as HTMLInputElement).checked);
  }

  protected resetManualCheckpoints(): void {
    void this.tweaks.setManualCheckpoints(false);
  }

  protected setCheckpointLag(lag: number | undefined): void {
    void this.tweaks.setCheckpointLag(lag);
  }

  protected setHandOver(handOver: number | undefined): void {
    void this.tweaks.setHandOver(handOver);
  }

  protected setGroupPause(pause: number | undefined): void {
    void this.tweaks.setGroupPause(pause);
  }

  protected setFastForward(fastForward: number | undefined): void {
    void this.tweaks.setFastForward(fastForward);
  }

  protected setFaintOpacity(opacity: number | undefined): void {
    void this.tweaks.setFaintOpacity(opacity);
  }

  /** An opacity, in percent. */
  protected percent(opacity: number): string {
    return `${String(Math.round(opacity * 100))}%`;
  }

  protected setDiscoverySpeed(speed: number | undefined): void {
    void this.tweaks.setDiscoverySpeed(speed);
  }

  protected setPaceStep(step: number | undefined): void {
    void this.tweaks.setPaceStep(step);
  }

  protected setSolidKeys(solid: boolean): void {
    void this.tweaks.setSolidKeys(solid);
  }

  protected setUnchecked(event: Event): void {
    void this.tweaks.setChecking(!(event.target as HTMLInputElement).checked);
  }

  protected setMerge(event: Event): void {
    void this.merge.set((event.target as HTMLInputElement).checked);
  }

  protected resetMerge(): void {
    void this.merge.set(true);
  }

  protected setVibration(event: Event): void {
    void this.vibration.set((event.target as HTMLInputElement).checked);
  }

  protected resetVibration(): void {
    void this.vibration.set(true);
  }

  protected resetPace(): void {
    void this.discoveryPace.set(DEFAULT_DISCOVERY_PACE);
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

  protected resetGroupSize(): void {
    void this.groupSize.set(DEFAULT_GROUP_SIZE);
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
    this.resetMerge();
    this.resetGroupSize();
    this.resetPace();
    this.resetVibration();
    this.resetSound();
    if (this.developerMode.enabled()) {
      this.setSolidKeys(false);
      this.setBreath(undefined);
      this.setUnavailable(undefined);
      this.setDiscoverySpeed(undefined);
      this.setPaceStep(undefined);
      this.setHandOver(undefined);
      this.setGroupPause(undefined);
      this.setFastForward(undefined);
      this.setFaintOpacity(undefined);
      this.resetManualCheckpoints();
      this.setCheckpointLag(undefined);
      this.resetCountdown();
      this.resetSoundNotes();
      this.resetChecking();
    }
  }
}
