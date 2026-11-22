import { Component, computed, inject, signal } from '@angular/core';
import { Tweaks } from '../../developer-mode/tweaks';
import { Celebration } from '../../feedback/celebration/celebration';
import { MILESTONE_SOUND, MILESTONE_SOUNDS } from '../../feedback/celebration/milestone-sounds';
import {
  FIRST_MILESTONE_WAVE,
  MILESTONE_WAVE,
  MILESTONE_WAVE_SLIDERS,
  MilestoneWave,
} from '../../feedback/celebration/milestone-wave';
import { KEY_LINGER, MAX_KEY_LINGER } from '../../game/layers/place-colors';
import { GAME_LINGER, MAX_GAME_LINGER } from '../../game/modes/discovery-pace';
import { KEY_MOTION, KeyMotion } from '../play/keypad/key-merges';
import { KEY_MOTION_SLIDERS } from '../play/keypad/key-motion-sliders';
import { Candy } from '../../ui/candy';
import { Page } from '../../ui/page';
import { Segment, Segmented } from '../../ui/segmented';
import { Slider } from '../../ui/slider';
import { TabPanel, TabPanels } from '../../ui/tab-panels';
import { CopyValues } from './copy-values';
import { MAX_TURN_SWITCH, TURN_SWITCH } from '../play/turn-shown';

/** The page's tabs: the keypad's motion, and the milestones' celebrations. */
type Tab = 'keypad' | 'milestones';

/**
 * Developer mode's page to tune the game's transitions, on two tabs. On the keypad's: how long its keys take to move,
 * to sink as pressed, or rise back, to merge, and to linger in the color they took as pressed, longer as Discovery's
 * game plays them, and how long it takes to show the other turn as the player switches turns in Discovery. On the
 * milestones' celebrations': the sound they play, whether their waves bend the screen, which is being tried, and the waves of the first time a milestone is ever reached and of
 * every other time, each played over this page by its button. They apply to the whole game while developer mode is
 * on, to try them in it.
 */
@Component({
  selector: 'app-transitions',
  imports: [Candy, CopyValues, Page, Segmented, Slider, TabPanel, TabPanels],
  template: `
    <app-page heading="Transitions" icon="transitions">
      <button pageAction type="button" appCandy="danger" [disabled]="!tuned()" (click)="reset()">
        Reset All
      </button>
      <app-segmented
        label="Transitions"
        panels="transitions"
        [segments]="tabs"
        [follows]="panes"
        [(value)]="tab"
      />
      <app-tab-panels #panes panels="transitions" [fills]="true" [(value)]="tab">
        <section class="panel keypad" appTabPanel="keypad">
          <app-slider
            label="Press"
            [value]="motion().press"
            [min]="press.min"
            [max]="press.max"
            [step]="press.step"
            [valueText]="press.format(motion().press)"
            [defaultValue]="defaults.press"
            (changed)="set('press', $event)"
          />
          <app-slider
            label="Merge"
            [value]="motion().merge"
            [min]="merge.min"
            [max]="merge.max"
            [step]="merge.step"
            [valueText]="merge.format(motion().merge)"
            [defaultValue]="defaults.merge"
            (changed)="set('merge', $event)"
          />
          <app-slider
            label="Linger"
            [value]="tweaks.keyLinger()"
            [min]="0"
            [max]="maxLinger"
            [step]="10"
            [valueText]="tweaks.keyLinger() + ' ms'"
            [defaultValue]="defaultLinger"
            (changed)="setLinger($event)"
          />
          <app-slider
            label="Discovery Linger"
            [value]="tweaks.gameLinger()"
            [min]="1"
            [max]="maxGameLinger"
            [step]="0.1"
            [valueText]="'×' + tweaks.gameLinger()"
            [defaultValue]="defaultGameLinger"
            (changed)="setGameLinger($event)"
          />
          <app-slider
            label="Turn Switch"
            [value]="tweaks.turnSwitch()"
            [min]="0"
            [max]="maxTurnSwitch"
            [step]="10"
            [valueText]="tweaks.turnSwitch() + ' ms'"
            [defaultValue]="defaultTurnSwitch"
            (changed)="setTurnSwitch($event)"
          />
        </section>
        <div class="celebrations" appTabPanel="milestones">
          <section class="panel" aria-label="Sound">
            <app-segmented
              label="Milestone sound"
              [segments]="sounds"
              [value]="tweaks.milestoneSound()"
              (valueChange)="setSound($event)"
            />
            <label class="setting">
              Bend the Screen
              <input
                type="checkbox"
                [checked]="tweaks.bendScreen()"
                (change)="setBendScreen($event)"
              />
            </label>
          </section>
          @for (wave of waves; track wave.first) {
            <section class="panel" [attr.aria-labelledby]="wave.id">
              <div class="head">
                <h2 [id]="wave.id">{{ wave.title }}</h2>
                <button type="button" class="frosted pill" (click)="celebrate(wave.first)">
                  Play
                </button>
              </div>
              <div class="pairs">
                @for (slider of waveSliders; track slider.key) {
                  @let value = wave.first ? firstWave()[slider.key] : milestoneWave()[slider.key];
                  <app-slider
                    [label]="slider.label"
                    [value]="value"
                    [min]="slider.min"
                    [max]="slider.max"
                    [step]="slider.step"
                    [valueText]="slider.format(value)"
                    [defaultValue]="wave.defaults[slider.key]"
                    (changed)="setWave(wave.first, slider.key, $event)"
                  />
                }
              </div>
            </section>
          }
        </div>
      </app-tab-panels>
      <app-copy-values
        label="Copy Values"
        [values]="{
          keyMotion: motion(),
          keyLinger: tweaks.keyLinger(),
          gameLinger: tweaks.gameLinger(),
          turnSwitch: tweaks.turnSwitch(),
          milestoneSound: tweaks.milestoneSound(),
          firstMilestoneWave: firstWave(),
          milestoneWave: milestoneWave(),
        }"
      />
    </app-page>
  `,
  styleUrl: './transitions.css',
})
export class Transitions {
  protected readonly tweaks = inject(Tweaks);
  private readonly celebration = inject(Celebration);
  protected readonly defaults = KEY_MOTION;
  protected readonly maxLinger = MAX_KEY_LINGER;
  protected readonly defaultLinger = KEY_LINGER;
  protected readonly maxGameLinger = MAX_GAME_LINGER;
  protected readonly defaultGameLinger = GAME_LINGER;
  protected readonly merge = slider('merge');
  protected readonly press = slider('press');
  protected readonly maxTurnSwitch = MAX_TURN_SWITCH;
  protected readonly defaultTurnSwitch = TURN_SWITCH;
  protected readonly tabs: readonly Segment<Tab>[] = [
    { value: 'keypad', label: 'Keypad' },
    { value: 'milestones', label: 'Milestone Celebrations' },
  ];
  protected readonly tab = signal<Tab>('keypad');
  protected readonly sounds: readonly Segment<string>[] = MILESTONE_SOUNDS.map(({ id, label }) => ({
    value: id,
    label,
  }));
  protected readonly waveSliders = MILESTONE_WAVE_SLIDERS;
  protected readonly waves = [
    { first: true, id: 'first-wave', title: 'First Time', defaults: FIRST_MILESTONE_WAVE },
    { first: false, id: 'every-wave', title: 'Every Time', defaults: MILESTONE_WAVE },
  ] as const;

  /** How long the keys take to move, being tuned. */
  protected readonly motion = signal<KeyMotion>(this.tweaks.values().keyMotion ?? KEY_MOTION);
  /** The milestones' waves, being tuned. */
  protected readonly firstWave = signal<MilestoneWave>(this.tweaks.firstMilestoneWave());
  protected readonly milestoneWave = signal<MilestoneWave>(this.tweaks.milestoneWave());
  protected readonly tuned = computed(
    () =>
      this.motion().merge !== KEY_MOTION.merge ||
      this.motion().press !== KEY_MOTION.press ||
      this.tweaks.keyLinger() !== KEY_LINGER ||
      this.tweaks.gameLinger() !== GAME_LINGER ||
      this.tweaks.turnSwitch() !== TURN_SWITCH ||
      this.tweaks.milestoneSound() !== MILESTONE_SOUND ||
      this.tweaks.bendScreen() ||
      MILESTONE_WAVE_SLIDERS.some(
        ({ key }) =>
          this.firstWave()[key] !== FIRST_MILESTONE_WAVE[key] ||
          this.milestoneWave()[key] !== MILESTONE_WAVE[key],
      ),
  );

  protected set(key: keyof KeyMotion, value: number): void {
    this.motion.update((motion) => ({ ...motion, [key]: value }));
    void this.tweaks.setKeyMotion(this.motion());
  }

  protected setLinger(linger: number): void {
    void this.tweaks.setKeyLinger(linger);
  }

  protected setTurnSwitch(duration: number): void {
    void this.tweaks.setTurnSwitch(duration);
  }

  protected setGameLinger(linger: number): void {
    void this.tweaks.setGameLinger(linger);
  }

  protected setSound(id: string): void {
    void this.tweaks.setMilestoneSound(id);
  }

  protected setBendScreen(event: Event): void {
    void this.tweaks.setBendScreen((event.target as HTMLInputElement).checked);
  }

  protected setWave(first: boolean, key: keyof MilestoneWave, value: number): void {
    if (first) {
      this.firstWave.update((wave) => ({ ...wave, [key]: value }));
      void this.tweaks.setFirstMilestoneWave(this.firstWave());
    } else {
      this.milestoneWave.update((wave) => ({ ...wave, [key]: value }));
      void this.tweaks.setMilestoneWave(this.milestoneWave());
    }
  }

  /** Plays a milestone's celebration over the page, in the first milestone's color, as the game would. */
  protected celebrate(first: boolean): void {
    this.celebration.celebrate(first, this.tweaks.palette()[0] ?? '#ffffff');
  }

  protected reset(): void {
    this.motion.set(KEY_MOTION);
    this.firstWave.set(FIRST_MILESTONE_WAVE);
    this.milestoneWave.set(MILESTONE_WAVE);
    void this.tweaks.setKeyMotion(undefined);
    void this.tweaks.setKeyLinger(undefined);
    void this.tweaks.setGameLinger(undefined);
    void this.tweaks.setTurnSwitch(undefined);
    void this.tweaks.setMilestoneSound(undefined);
    void this.tweaks.setBendScreen(false);
    void this.tweaks.setFirstMilestoneWave(undefined);
    void this.tweaks.setMilestoneWave(undefined);
  }
}

/** A slider of the keys' motion. */
function slider(key: keyof KeyMotion) {
  const found = KEY_MOTION_SLIDERS.find((each) => each.key === key);
  if (found === undefined) {
    throw new Error(`No slider for ${key}`);
  }
  return found;
}
