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
import { KNOWN_DECIMALS } from '../../game/pi/pi';
import { RUN_CLOCK } from '../../player-data/run-recorder';
import { TIMER } from '../play/timer';
import { isDigit } from '../../game/pi/digit';
import { groupRuns, Run } from '../../player-data/run';
import { RunStore } from '../../player-data/run-store';
import { Candy } from '../../ui/candy';
import { Page } from '../../ui/page';
import { Segment, Segmented } from '../../ui/segmented';
import { CopyValues } from './copy-values';

/** The words the page plays past the player's groups, as the slots of a new player do. */
export const LISTENED_WORD = 5;
/** How long from one digit to the next, in ms, and from a word's last digit to the next word's first. */
export const LISTENED_DIGIT = 260;
export const LISTENED_BREAK = 700;
/** How far ahead the page hands the notes to the speaker, in ms, and how often it does, so that none is late. */
export const LISTEN_AHEAD = 1500;
export const LISTEN_PERIOD = 500;

/** A chime of the song, and when it plays, in ms from the start. */
export interface Played {
  readonly at: number;
  readonly chime: Chime;
}

/**
 * The song of π from its first place to the last the game knows, as the page plays it, one chime after the other: in
 * the player's `groups`, then in words of {@link LISTENED_WORD}, each word landing after its last digit, if
 * `landings`. Worked out as it's played, as there's far too much of it to work out at once.
 */
export function* song(
  model: SoundModel,
  groups: readonly number[],
  landings: boolean,
): Generator<Played, void, undefined> {
  const words: number[] = [];
  let at = 0;
  let place = 1;
  while (place <= KNOWN_DECIMALS) {
    const size = Math.min(groups[words.length] ?? LISTENED_WORD, KNOWN_DECIMALS - place + 1);
    const before = [...words];
    for (let index = 0; index < size; index++, place++) {
      const digit = PI_DECIMALS.charAt(place - 1);
      if (isDigit(digit)) {
        const typed = PI_DECIMALS.slice(0, place - 1);
        yield { at, chime: model.keys({ typed, words: before, slots: size })[digit] };
      }
      at += index === size - 1 ? 0 : LISTENED_DIGIT;
    }
    words.push(size);
    if (landings) {
      yield { at: at + LISTENED_DIGIT, chime: model.landing([...words]) };
    }
    at += LISTENED_BREAK;
  }
}

/**
 * Developer mode's page to tune the sounds: the sound model the keys are played with, and the mix, how loud the melody
 * and its chords are and how long notes ring, and whether words land with a chord. A button plays the song of π from its
 * start, in the player's groups as the break model finds them, until stopped, to hear it without typing; trying the keys at a place, from the pause dialog, plays them there.
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
  private readonly clock = inject(RUN_CLOCK);
  private readonly timer = inject(TIMER);
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
  protected readonly wordsShown = computed(() =>
    this.groups().length === 0
      ? `Plays π in words of ${String(LISTENED_WORD)} until you stop it, as you have no groups yet.`
      : `Plays π in your ${String(this.groups().length)} groups, then in words of ${String(LISTENED_WORD)}, until you stop it.`,
  );

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
  /**
   * Plays the song of π, as the model picked plays it, in the player's groups, then in words of 5, landing as they end,
   * until stopped: a little at a time, handing the notes to the speaker a little ahead.
   */
  protected listen(): void {
    const chimes = song(this.kind().create(), this.groups(), this.landings());
    const start = this.clock.now();
    let next = chimes.next();
    let stops: (() => void)[] = [];
    const schedule = (): void => {
      const now = this.clock.now() - start;
      while (!next.done && next.value.at < now + LISTEN_AHEAD) {
        stops.push(this.speaker.play(next.value.chime, Math.max(0, next.value.at - now)));
        next = chimes.next();
      }
      // Those handed over long ago have started, past stopping.
      stops = stops.slice(-64);
      if (next.done) {
        cancel();
        this.listening.set(false);
      }
    };
    const cancel = this.timer.every(LISTEN_PERIOD, schedule);
    this.stopSong = () => {
      cancel();
      for (const stop of stops) {
        stop();
      }
    };
    this.listening.set(true);
    schedule();
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
