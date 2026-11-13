import { Component, computed, inject, signal } from '@angular/core';
import { Tweaks } from '../../developer-mode/tweaks';
import { KEY_LINGER, MAX_KEY_LINGER } from '../../game/layers/place-colors';
import { GAME_LINGER, MAX_GAME_LINGER } from '../../game/modes/discover-pace';
import { KEY_MOTION, KeyMotion } from '../play/keypad/key-merges';
import { KEY_MOTION_SLIDERS } from '../play/keypad/key-motion-sliders';
import { Candy } from '../../ui/candy';
import { Page } from '../../ui/page';
import { Slider } from '../../ui/slider';
import { CopyValues } from './copy-values';
import { MAX_TURN_SWITCH, TURN_SWITCH } from '../play/turn-shown';

/**
 * Developer mode's page to tune how long the keypad's keys take to move: to sink as pressed, or rise back, to merge,
 * and to linger in the color they took as pressed, longer as Discover's game plays them; and how long the keypad
 * takes to show the other turn as the player switches turns in Discover. They apply to the whole game while developer mode is
 * on, to try them in it.
 */
@Component({
  selector: 'app-transitions',
  imports: [Candy, CopyValues, Page, Slider],
  template: `
    <app-page heading="Transitions">
      <button pageAction type="button" appCandy="danger" [disabled]="!tuned()" (click)="reset()">
        Reset All
      </button>
      <section class="panel">
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
          label="Discover Linger"
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
      <app-copy-values
        label="Copy Values"
        [values]="{
          keyMotion: motion(),
          keyLinger: tweaks.keyLinger(),
          gameLinger: tweaks.gameLinger(),
          turnSwitch: tweaks.turnSwitch(),
        }"
      />
    </app-page>
  `,
  styleUrl: './transitions.css',
})
export class Transitions {
  protected readonly tweaks = inject(Tweaks);
  protected readonly defaults = KEY_MOTION;
  protected readonly maxLinger = MAX_KEY_LINGER;
  protected readonly defaultLinger = KEY_LINGER;
  protected readonly maxGameLinger = MAX_GAME_LINGER;
  protected readonly defaultGameLinger = GAME_LINGER;
  protected readonly merge = slider('merge');
  protected readonly press = slider('press');
  protected readonly maxTurnSwitch = MAX_TURN_SWITCH;
  protected readonly defaultTurnSwitch = TURN_SWITCH;

  /** How long the keys take to move, being tuned. */
  protected readonly motion = signal<KeyMotion>(this.tweaks.values().keyMotion ?? KEY_MOTION);
  protected readonly tuned = computed(
    () =>
      this.motion().merge !== KEY_MOTION.merge ||
      this.motion().press !== KEY_MOTION.press ||
      this.tweaks.keyLinger() !== KEY_LINGER ||
      this.tweaks.gameLinger() !== GAME_LINGER ||
      this.tweaks.turnSwitch() !== TURN_SWITCH,
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

  protected reset(): void {
    this.motion.set(KEY_MOTION);
    void this.tweaks.setKeyMotion(undefined);
    void this.tweaks.setKeyLinger(undefined);
    void this.tweaks.setGameLinger(undefined);
    void this.tweaks.setTurnSwitch(undefined);
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
