import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Tweaks } from '../../developer-mode/tweaks';
import { Speaker } from '../../feedback/speaker';
import { MIX_SLIDERS, SOUND_MIX, SoundMix } from '../../feedback/sound-mix';
import { Chime, SoundModel, SoundModelKind } from '../../game/layers/sound/sound-model';
import {
  SOUND_MODEL,
  SOUND_MODELS,
  soundModelKindById,
} from '../../game/layers/sound/sound-models';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { isDigit } from '../../game/pi/digit';
import { Candy } from '../../ui/candy';
import { Page } from '../../ui/page';
import { Segment, Segmented } from '../../ui/segmented';
import { CopyValues } from './copy-values';

/** How many of π's places the page plays, from the first. */
export const LISTENED_PLACES = 40;
/** The words it plays them in, as the slots of a new player do. */
export const LISTENED_WORD = 5;
/** How long from one digit to the next, in ms, and from a word's last digit to the next word's first. */
export const LISTENED_DIGIT = 260;
export const LISTENED_BREAK = 700;

/** When each digit and each landing plays, in ms from the start, and what. */
export function listening(model: SoundModel): { readonly at: number; readonly chime: Chime }[] {
  const played: { at: number; chime: Chime }[] = [];
  const words: number[] = [];
  let at = 0;
  for (let place = 1; place <= LISTENED_PLACES; place++) {
    const digit = PI_DECIMALS.charAt(place - 1);
    const typed = place - 1 - words.reduce((total, size) => total + size, 0);
    if (isDigit(digit)) {
      played.push({ at, chime: model.keys({ place, words, slots: LISTENED_WORD })[digit] });
    }
    if (typed + 1 === LISTENED_WORD || place === LISTENED_PLACES) {
      words.push(typed + 1);
      played.push({ at: at + LISTENED_DIGIT, chime: model.landing(words) });
      at += LISTENED_BREAK;
    } else {
      at += LISTENED_DIGIT;
    }
  }
  return played;
}

/**
 * Developer mode's page to tune the sounds: the sound model the keys are played with, and the mix, how loud the melody
 * and its chords are and how long notes ring. A button plays the start of the song of π, in words of 5, to hear it
 * without typing; trying the keys at a place, from the pause dialog, plays them there.
 */
@Component({
  selector: 'app-sounds',
  imports: [Candy, CopyValues, Page, Segmented],
  template: `
    <app-page heading="Sounds">
      <button pageAction type="button" appCandy="danger" [disabled]="!tuned()" (click)="reset()">
        Reset All
      </button>
      <section class="panel" aria-labelledby="model-title">
        <h2 id="model-title">Sound Model</h2>
        <app-segmented
          label="Sound model"
          [segments]="models"
          [value]="kind().id"
          (valueChange)="pick($event)"
        />
        <p class="about">{{ kind().description }}</p>
        <button
          type="button"
          appCandy="primary"
          data-vibration="none"
          (click)="listening() ? stop() : listen()"
        >
          {{ listening() ? 'Stop' : 'Play the Song of π' }}
        </button>
      </section>
      <section class="panel" aria-labelledby="mix-title">
        <h2 id="mix-title">Mix</h2>
        @for (slider of sliders; track slider.key) {
          <label class="slider">
            <span class="label">
              {{ slider.label }}
              <span class="value">{{ slider.format(mix()[slider.key]) }}</span>
            </span>
            <input
              type="range"
              [min]="slider.min"
              [max]="slider.max"
              [step]="slider.step"
              [value]="mix()[slider.key]"
              (input)="set(slider.key, $event)"
            />
          </label>
        }
      </section>
      <app-copy-values [values]="{ soundModel: kind().id, sound: mix() }" />
    </app-page>
  `,
  styleUrl: './sounds.css',
})
export class Sounds {
  protected readonly sliders = MIX_SLIDERS;
  protected readonly models: readonly Segment<string>[] = SOUND_MODELS.map(({ id, label }) => ({
    value: id,
    label,
  }));

  private readonly tweaks = inject(Tweaks);
  private readonly speaker = inject(Speaker);
  /** The sound model picked, and the mix being tuned. */
  protected readonly kind = signal<SoundModelKind>(this.storedKind());
  protected readonly mix = signal<SoundMix>(this.tweaks.values().sound ?? SOUND_MIX);
  private edited = false;
  /** Stops the song playing, if it is. */
  private stopSong: (() => void) | undefined;
  protected readonly listening = signal(false);

  protected readonly tuned = computed(
    () =>
      this.kind() !== SOUND_MODEL ||
      MIX_SLIDERS.some(({ key }) => this.mix()[key] !== SOUND_MIX[key]),
  );

  constructor() {
    void this.tweaks.loaded.then(() => {
      if (!this.edited) {
        this.kind.set(this.storedKind());
        this.mix.set(this.tweaks.values().sound ?? SOUND_MIX);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.stop();
    });
  }

  protected pick(id: string): void {
    const kind = soundModelKindById(id);
    if (kind !== undefined) {
      this.edited = true;
      this.kind.set(kind);
      void this.tweaks.setSoundModel(kind);
    }
  }

  protected set(key: keyof SoundMix, event: Event): void {
    this.edited = true;
    this.mix.update((mix) => ({ ...mix, [key]: Number((event.target as HTMLInputElement).value) }));
    void this.tweaks.setSoundMix(this.mix());
  }

  protected reset(): void {
    this.edited = true;
    this.kind.set(SOUND_MODEL);
    this.mix.set(SOUND_MIX);
    void this.tweaks.setSoundModel(undefined).then(() => this.tweaks.setSoundMix(undefined));
  }

  /** Plays the start of the song of π, as the model picked plays it, in words of 5, landing as they end. */
  protected listen(): void {
    const song = listening(this.kind().create());
    const stops = song.map(({ at, chime }) => this.speaker.play(chime, at));
    const played = song.at(-1)?.at ?? 0;
    const timer = setTimeout(() => {
      this.listening.set(false);
    }, played + 1000);
    this.stopSong = () => {
      clearTimeout(timer);
      for (const stop of stops) {
        stop();
      }
    };
    this.listening.set(true);
  }

  protected stop(): void {
    this.stopSong?.();
    this.stopSong = undefined;
    this.listening.set(false);
  }

  private storedKind(): SoundModelKind {
    return soundModelKindById(this.tweaks.values().soundModel) ?? SOUND_MODEL;
  }
}
