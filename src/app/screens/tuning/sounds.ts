import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Tweaks, TweakValues } from '../../developer-mode/tweaks';
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
import { groupRuns, Run } from '../../player-data/run';
import { RunStore } from '../../player-data/run-store';
import { Candy } from '../../ui/candy';
import { Page } from '../../ui/page';
import { Segment, Segmented } from '../../ui/segmented';
import { CopyValues } from './copy-values';

/** How many of π's places the page plays at least, and at most. */
export const LISTENED_PLACES = 40;
export const MOST_LISTENED = 100;
/** The words it plays past the player's groups, as the slots of a new player do. */
export const LISTENED_WORD = 5;
/** How long from one digit to the next, in ms, and from a word's last digit to the next word's first. */
export const LISTENED_DIGIT = 260;
export const LISTENED_BREAK = 700;

/**
 * The sizes of the words the page plays π's first places in: the player's groups, as many as fit in
 * {@link MOST_LISTENED} places, then words of {@link LISTENED_WORD} up to {@link LISTENED_PLACES} places, if the
 * groups don't reach that far.
 */
export function listenedWords(groups: readonly number[]): number[] {
  const words: number[] = [];
  let places = 0;
  for (const size of groups) {
    if (places + size > MOST_LISTENED) {
      break;
    }
    words.push(size);
    places += size;
  }
  while (places < LISTENED_PLACES) {
    words.push(LISTENED_WORD);
    places += LISTENED_WORD;
  }
  return words;
}

/** When each digit of the words plays, in ms from the start, and what, each word landing after its last, if `landings`. */
export function listening(
  model: SoundModel,
  words: readonly number[],
  landings: boolean,
): { readonly at: number; readonly chime: Chime }[] {
  const played: { at: number; chime: Chime }[] = [];
  let at = 0;
  let place = 1;
  for (const [index, size] of words.entries()) {
    const before = words.slice(0, index);
    for (let digit = 0; digit < size; digit++, place++) {
      const typed = PI_DECIMALS.charAt(place - 1);
      if (isDigit(typed)) {
        played.push({ at, chime: model.keys({ place, words: before, slots: size })[typed] });
      }
      at += digit === size - 1 ? 0 : LISTENED_DIGIT;
    }
    if (landings) {
      played.push({ at: at + LISTENED_DIGIT, chime: model.landing(words.slice(0, index + 1)) });
    }
    at += LISTENED_BREAK;
  }
  return played;
}

/**
 * Developer mode's page to tune the sounds: the sound model the keys are played with, and the mix, how loud the melody
 * and its chords are and how long notes ring, and whether words land with a chord. A button plays the start of the song
 * of π, in the player's groups as the break model finds them, to hear it without typing; trying the keys at a place, from the pause dialog, plays them there.
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
        <label class="setting">
          <span>
            Landing Chords
            <small>A chord as each word lands on the tape, open then closed.</small>
          </span>
          <input type="checkbox" [checked]="landings()" (change)="setLandings($event)" />
        </label>
        <p class="about">{{ wordsShown() }}</p>
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
      <app-copy-values [values]="copied()" />
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

  /** The values tuned here, to copy. */
  protected readonly copied = computed((): TweakValues => ({
    soundModel: this.kind().id,
    sound: this.mix(),
    ...(this.landings() ? {} : { landings: false as const }),
  }));
  /** Whether words land with a chord. */
  protected readonly landings = signal(this.tweaks.values().landings !== false);
  /** The player's runs, to play the song in their groups. */
  private readonly runs = signal<readonly Run[]>([]);
  /** The sizes of the player's groups, as the break model finds them, those it knows the end of. */
  private readonly groups = computed(() =>
    this.tweaks
      .breakModel()
      .stats(
        groupRuns(this.runs(), this.tweaks.includeUnchecked(), this.tweaks.runOrder()).map(
          (run) => run.times,
        ),
      )
      .groups.filter((group) => !group.open)
      .map((group) => group.size),
  );
  /** The words the song plays in. */
  protected readonly words = computed(() => listenedWords(this.groups()));
  protected readonly wordsShown = computed(() => {
    const places = this.groups().reduce((total, size) => total + size, 0);
    const words = this.words();
    const played = words.reduce((total, size) => total + size, 0);
    return places === 0
      ? `Plays π's first ${String(played)} places in words of ${String(LISTENED_WORD)}, until you have groups.`
      : `Plays π's first ${String(played)} places in your groups${places < LISTENED_PLACES ? `, then words of ${String(LISTENED_WORD)}` : ''}.`;
  });

  protected readonly tuned = computed(
    () =>
      this.kind() !== SOUND_MODEL ||
      !this.landings() ||
      MIX_SLIDERS.some(({ key }) => this.mix()[key] !== SOUND_MIX[key]),
  );

  constructor() {
    void this.tweaks.loaded.then(() => {
      if (!this.edited) {
        this.kind.set(this.storedKind());
        this.mix.set(this.tweaks.values().sound ?? SOUND_MIX);
        this.landings.set(this.tweaks.values().landings !== false);
      }
    });
    void inject(RunStore)
      .runs()
      .then((runs) => {
        this.runs.set(runs);
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

  protected setLandings(event: Event): void {
    this.edited = true;
    this.landings.set((event.target as HTMLInputElement).checked);
    void this.tweaks.setLandings(this.landings());
  }

  protected reset(): void {
    this.edited = true;
    this.kind.set(SOUND_MODEL);
    this.mix.set(SOUND_MIX);
    this.landings.set(true);
    void this.tweaks.setSoundModel(undefined);
    void this.tweaks.setSoundMix(undefined);
    void this.tweaks.setLandings(true);
  }

  /** Plays the start of the song of π, as the model picked plays it, in words of 5, landing as they end. */
  protected listen(): void {
    const song = listening(this.kind().create(), this.words(), this.landings());
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
