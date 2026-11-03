import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Tweaks, TweakValues } from '../../developer-mode/tweaks';
import { Speaker } from '../../feedback/speaker';
import { MIX_SLIDERS, SOUND_MIX, SoundMix } from '../../feedback/sound-mix';
import { Souring, SOURING, SOURING_SLIDERS } from '../../feedback/souring';
import { keyColorIndices } from '../../game/layers/place-colors';
import { seasonOf } from '../../game/layers/seasons';
import { Chime, SoundModel, SoundModelKind } from '../../game/layers/sound/sound-model';
import {
  SOUND_MODEL,
  SOUND_MODELS,
  soundModelKindById,
} from '../../game/layers/sound/sound-models';
import { isDigit } from '../../game/pi/digit';
import { KNOWN_DECIMALS } from '../../game/pi/pi';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { groupRuns, Run } from '../../player-data/run';
import { RUN_CLOCK } from '../../player-data/run-recorder';
import { RunStore } from '../../player-data/run-store';
import { Candy } from '../../ui/candy';
import { Page } from '../../ui/page';
import { Slider } from '../../ui/slider';
import { Segment, Segmented } from '../../ui/segmented';
import { SoundLog } from '../play/sound-log/sound-log';
import { TIMER } from '../play/timer';
import { CopyValues } from './copy-values';

/** The words the page plays past the player's groups, as the slots of a new player do. */
export const LISTENED_WORD = 5;
/** How long from one digit to the next, in ms, and from a word's last digit to the next word's first. */
export const LISTENED_DIGIT = 260;
export const LISTENED_BREAK = 700;
/** How far ahead the page hands the notes to the speaker, in ms, and how often it does, so that none is late. */
export const LISTEN_AHEAD = 1500;
export const LISTEN_PERIOD = 500;
/** How many lines of what plays the page keeps. */
const LOG_LINES = 200;

/** A chime of the song, when it plays, in ms from the start, and what it is, in a line. */
export interface Played {
  readonly at: number;
  readonly chime: Chime;
  readonly line: string;
}

/**
 * The song of π from its first place to the last the game knows, as the page plays it, one chime after the other,
 * exactly as typed in the game: in the player's `groups`, then in words of {@link LISTENED_WORD}, each key in its color,
 * each word landing after its last digit, if `landings`. Worked out as it's played, as there's far too much of it to
 * work out at once.
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
        const moment = {
          typed,
          words: before,
          slots: size,
          colors: keyColorIndices(typed),
          season: seasonOf(place - 1),
        };
        yield { at, chime: model.keys(moment)[digit], line: model.describe(moment, digit) };
      }
      at += index === size - 1 ? 0 : LISTENED_DIGIT;
    }
    words.push(size);
    if (landings) {
      const typed = PI_DECIMALS.slice(0, place - 1);
      yield {
        at: at + LISTENED_DIGIT,
        chime: model.landing(typed, words),
        line: model.describeLanding(typed, words),
      };
    }
    at += LISTENED_BREAK;
  }
}

/**
 * Developer mode's page to tune the sound models: the one the keys are played with, how it works, in a dialog, how
 * loud its chords are, and whether words land with a chord. A button plays the song of π as the model plays it, in the
 * player's groups as the break model finds them, until stopped, each line of what plays shown as it plays.
 */
@Component({
  selector: 'app-sounds',
  imports: [Candy, CopyValues, Page, Segmented, Slider, SoundLog],
  template: `
    <app-page heading="Sound Models">
      <button pageAction type="button" appCandy="danger" [disabled]="!tuned()" (click)="reset()">
        Reset All
      </button>
      <div class="model">
        <app-segmented
          label="Sound model"
          [segments]="models"
          [value]="kind().id"
          (valueChange)="pick($event)"
        />
        <button
          type="button"
          class="round"
          aria-haspopup="dialog"
          [title]="'About ' + kind().label"
          (click)="about.showModal()"
        >
          ?
        </button>
      </div>
      @for (slider of sliders; track slider.key) {
        <app-slider
          [label]="slider.label"
          [value]="mix()[slider.key]"
          [min]="slider.min"
          [max]="slider.max"
          [step]="slider.step"
          [valueText]="slider.format(mix()[slider.key])"
          (changed)="set(slider.key, $event)"
        />
      }
      <fieldset class="souring">
        <legend>Souring</legend>
        @for (slider of souringSliders; track slider.key) {
          <app-slider
            [label]="slider.label"
            [value]="souring()[slider.key]"
            [min]="slider.min"
            [max]="slider.max"
            [step]="slider.step"
            [valueText]="slider.format(souring()[slider.key])"
            (changed)="setSouring(slider.key, $event)"
          />
        }
      </fieldset>
      <label class="setting">
        Landing Chords
        <input type="checkbox" [checked]="landings()" (change)="setLandings($event)" />
      </label>
      <app-sound-log [lines]="lines()" />
      <button
        type="button"
        appCandy="primary"
        data-vibration="none"
        (click)="listening() ? stop() : listen()"
      >
        {{ listening() ? 'Stop' : 'Play π' }}
      </button>
      <app-copy-values label="Copy Values" [values]="copied()" />
      <dialog #about class="card" closedby="any" aria-labelledby="about-title">
        <h2 id="about-title">{{ kind().label }}</h2>
        <div class="explanation">
          @for (paragraph of kind().about; track $index) {
            <p>{{ paragraph }}</p>
          }
        </div>
        <button type="button" appCandy autofocus (click)="about.close()">Close</button>
      </dialog>
    </app-page>
  `,
  styleUrl: './sounds.css',
})
export class Sounds {
  protected readonly sliders = MIX_SLIDERS;
  protected readonly souringSliders = SOURING_SLIDERS;
  protected readonly models: readonly Segment<string>[] = SOUND_MODELS.map(({ id, label }) => ({
    value: id,
    label,
  }));

  private readonly tweaks = inject(Tweaks);
  private readonly speaker = inject(Speaker);
  private readonly clock = inject(RUN_CLOCK);
  private readonly timer = inject(TIMER);
  /** The sound model picked, the mix being tuned, and whether words land with a chord. */
  protected readonly kind = signal<SoundModelKind>(this.storedKind());
  protected readonly mix = signal<SoundMix>(this.tweaks.values().sound ?? SOUND_MIX);
  /** How a wrong key's note goes off, being tuned. */
  protected readonly souring = signal<Souring>(this.tweaks.values().souring ?? SOURING);
  protected readonly landings = signal(this.tweaks.values().landings !== false);
  private edited = false;
  /** Stops the song playing, if it is. */
  private stopSong: (() => void) | undefined;
  protected readonly listening = signal(false);
  /** What has played, one line each, oldest first. */
  protected readonly lines = signal<readonly string[]>([]);

  /** The values tuned here, to copy. */
  protected readonly copied = computed((): TweakValues => ({
    soundModel: this.kind().id,
    sound: this.mix(),
    souring: this.souring(),
    ...(this.landings() ? {} : { landings: false as const }),
  }));
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

  protected readonly tuned = computed(
    () =>
      this.kind() !== SOUND_MODEL ||
      !this.landings() ||
      MIX_SLIDERS.some(({ key }) => this.mix()[key] !== SOUND_MIX[key]) ||
      SOURING_SLIDERS.some(({ key }) => this.souring()[key] !== SOURING[key]),
  );

  constructor() {
    void this.tweaks.loaded.then(() => {
      if (!this.edited) {
        this.kind.set(this.storedKind());
        this.mix.set(this.tweaks.values().sound ?? SOUND_MIX);
        this.souring.set(this.tweaks.values().souring ?? SOURING);
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

  protected set(key: keyof SoundMix, value: number): void {
    this.edited = true;
    this.mix.update((mix) => ({ ...mix, [key]: value }));
    void this.tweaks.setSoundMix(this.mix());
  }

  protected setSouring(key: keyof Souring, value: number): void {
    this.edited = true;
    this.souring.update((souring) => ({ ...souring, [key]: value }));
    void this.tweaks.setSouring(this.souring());
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
    this.souring.set(SOURING);
    this.landings.set(true);
    void this.tweaks.setSoundModel(undefined);
    void this.tweaks.setSoundMix(undefined);
    void this.tweaks.setSouring(undefined);
    void this.tweaks.setLandings(true);
  }

  /**
   * Plays the song of π, as the model picked plays it, in the player's groups, then in words of 5, landing as they end,
   * until stopped: a little at a time, handing the notes to the speaker a little ahead, and showing each line of what
   * plays as it plays.
   */
  protected listen(): void {
    const chimes = song(this.kind().create(), this.groups(), this.landings());
    const groups = this.groups().length;
    this.lines.set([
      groups === 0
        ? `π in words of ${String(LISTENED_WORD)}`
        : `π in your ${String(groups)} groups, then words of ${String(LISTENED_WORD)}`,
    ]);
    const start = this.clock.now();
    let next = chimes.next();
    let stops: (() => void)[] = [];
    const schedule = (): void => {
      const now = this.clock.now() - start;
      while (!next.done && next.value.at < now + LISTEN_AHEAD) {
        const { chime, line, at } = next.value;
        const delay = Math.max(0, at - now);
        const unlog = this.timer.after(delay, () => {
          this.lines.update((lines) => [...lines.slice(1 - LOG_LINES), line]);
        });
        const playing = this.speaker.play(chime, delay);
        stops.push(() => {
          unlog();
          playing.stop();
        });
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
