import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { Background } from '../../ui/background';
import { FLIGHT_DURATION, flyIntoWord, snapshotSlot } from './flight/flight';
import { groupAt, groupDigits, groupEnds, slotCount } from '../../game/grouping/groups';
import { Keypad } from './keypad/keypad';
import { keyColors, placeColors } from '../../game/layers/place-colors';
import { Pause } from './pause/pause';
import { isPiDecimal } from '../../game/pi/pi';
import { groupRuns, Run } from '../../player-data/run';
import { RunRecorder } from '../../player-data/run-recorder';
import { RunStore } from '../../player-data/run-store';
import { KeypadKey } from '../../game/layers/keypad-layout';
import { SeasonHeader } from './season-header/season-header';
import { seasonAt } from '../../game/layers/seasons';
import { Tweaks } from '../../developer-mode/tweaks';
import { Slots } from './slots/slots';
import { BreakModel, breakModel, finishedRuns, Mixture } from '../../game/grouping/break-model';
import { TypedDigits } from './typed-digits/typed-digits';
import { TIMER } from './timer';

/**
 * The play screen: type the decimals of π on the keypad into the slots of the group being typed; each finished group
 * flies up to the typed digits as a word, as the seasons go by. Each typed digit takes the color its key showed.
 * The groups follow the player's timings, over all their runs and this one: the slots show the
 * player's own group where it's trusted, up to the trust horizon the earlier runs give, else 5 slots that grow until the
 * player pauses.
 * Every digit is checked against π, unless developer mode turns that off: a wrong one, and any typed on after it, show
 * as mistakes in their slots, and never finish the group, until backspace deletes them.
 * Backspace deletes the last digit, reopening the last word when the slots are empty, and brings the last word back when
 * it empties them, for the player to carry on, until they break there again. Pausing offers to restart the game
 * or end it, back to the main menu. Every key is recorded, with its time, in the player's runs; restarting or ending the
 * game ends the run.
 */
@Component({
  selector: 'app-play',
  imports: [Keypad, Pause, SeasonHeader, Slots, TypedDigits],
  host: { class: 'screen' },
  template: `
    <h1 class="visually-hidden">Slice of Pi</h1>
    <app-season-header [view]="season()" />
    <app-typed-digits [words]="grouping().words" [digits]="digits()" [colors]="placeColors()" />
    <app-slots
      class="slots"
      [digits]="grouping().current + mistakes()"
      [colors]="currentColors()"
      [size]="size()"
      [wrong]="mistakes().length"
    />
    <p class="visually-hidden" aria-live="assertive">
      @if (mistakes() !== '') {
        {{ mistakes().charAt(0) }} is wrong: delete back to it to go on.
      }
    </p>
    <app-keypad class="keypad" [colors]="keyColors()" (keyPressed)="press($event)" />
    <app-pause [(paused)]="paused" (restart)="restart()" />
  `,
  styleUrl: './play.css',
})
export class Play {
  /** The decimals typed so far: one character per digit, so even a very long sequence takes little memory. */
  protected readonly digits = signal('');
  /**
   * A wrong digit typed after them, and any typed on after it, until backspace deletes them all: they all show as
   * mistakes, and none is recorded.
   */
  protected readonly mistakes = signal('');

  /** The colors tuned in developer mode, or the game's own. */
  private readonly tweaks = inject(Tweaks);

  /** Whether the game is paused: keys typed on a keyboard meanwhile don't count. */
  protected readonly paused = signal(false);

  private readonly recorder = inject(RunRecorder);
  /** The hyperparameters of the break model, tuned in developer mode or the game's own. */
  private readonly settings = this.tweaks.grouping;
  /** The player's earlier runs, oldest first. */
  private readonly earlierRuns = signal<readonly Run[]>([]);
  /** What the break model makes of the earlier runs that count in the groups, before this one. */
  private readonly finished = computed(() =>
    finishedRuns(
      groupRuns(this.earlierRuns(), this.tweaks.includeUnchecked(), this.tweaks.runOrder()).map(
        (run) => run.times,
      ),
      this.settings().window,
    ),
  );
  /**
   * The trust horizon, as the earlier runs have it, before this run: frozen for the run, so that the groups shown don't
   * flicker between the player's own and growing ones as they type.
   */
  private readonly horizon = computed(
    () => breakModel(this.finished(), undefined, this.settings()).horizon,
  );
  /** The last mixture fitted, to start the next fit from, so that it takes only a few rounds. */
  private mixture: Mixture | undefined;
  /** The groups of all the player's runs, this one so far included. */
  private readonly found = computed(() => this.fit(this.recorder.run()?.times ?? []));

  /** The size of each finished group, in order. */
  private readonly sizes = signal<readonly number[]>([]);
  protected readonly grouping = computed(() => groupDigits(this.digits(), this.sizes()));
  /** How the group being typed is played. */
  private readonly plan = computed(() =>
    groupAt(
      this.found(),
      this.digits().length - this.grouping().current.length,
      this.settings(),
      this.horizon(),
    ),
  );
  /** The slots of the group being typed. */
  protected readonly size = computed(() => slotCount(this.plan(), this.grouping().current.length));

  /** The color of each typed place. */
  protected readonly placeColors = computed(() =>
    placeColors(this.digits(), this.tweaks.palette()),
  );
  /** The colors of the digits of the group being typed. */
  protected readonly currentColors = computed(() =>
    this.placeColors().slice(this.digits().length - this.grouping().current.length),
  );
  /** Each key's color: the color its digit takes when typed next. */
  protected readonly keyColors = computed(() => keyColors(this.digits(), this.tweaks.palette()));

  /** The season, and the background's colors, after the places typed so far. */
  protected readonly season = computed(() =>
    seasonAt(
      this.digits().length,
      this.tweaks.seasonBackgrounds(),
      this.tweaks.colorSpace(),
      this.tweaks.seasonTurn(),
    ),
  );

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly timer = inject(TIMER);
  private readonly typedDigits = viewChild.required(TypedDigits);
  /** Slots flying into their word. */
  private flights: Animation[] = [];
  /** Stops looking whether the player has paused. */
  private stopWatching = (): void => undefined;

  constructor() {
    // Ending the game, back to the main menu, ends the run.
    inject(DestroyRef).onDestroy(() => {
      this.stopWatching();
      this.recorder.end();
    });
    void inject(RunStore)
      .runs()
      .then((runs) => {
        // Leaving out the run being played, already saved if a key came first, and those already added on restarts.
        const playing = this.recorder.run()?.id;
        this.earlierRuns.update((added) => [
          ...runs.filter((run) => run.id !== playing && !added.some(({ id }) => id === run.id)),
          ...added,
        ]);
      });
    const background = inject(Background);
    effect(() => {
      background.colors.set(this.season().background);
    });
  }

  protected press(key: KeypadKey): void {
    if (this.paused()) {
      return;
    }
    if (this.mistakes() !== '') {
      if (key === 'backspace') {
        this.recorder.deleteMistake(this.digits().length + this.mistakes().length);
        this.mistakes.update((mistakes) => mistakes.slice(0, -1));
        this.bringBackEmptied(this.sizes().length);
      } else {
        this.mistakes.update((mistakes) => mistakes + key);
      }
      return;
    }
    if (
      key !== 'backspace' &&
      this.tweaks.checking() &&
      !isPiDecimal(this.digits().length + 1, key)
    ) {
      // A group never finishes on a mistake.
      this.stopWatching();
      this.mistakes.set(key);
      return;
    }
    this.recorder.record(key);
    if (key === 'backspace') {
      this.landFlights();
      const words = this.sizes().length;
      if (this.grouping().current === '') {
        this.sizes.update((sizes) => sizes.slice(0, -1));
      }
      this.digits.update((digits) => digits.slice(0, -1));
      this.bringBackEmptied(words);
    } else {
      this.digits.update((digits) => digits + key);
      this.watchForPause();
    }
  }

  /**
   * Brings the last word back into the slots once backspace has emptied them: the clock back to its last digit, the
   * player can carry it on, until they break there again. Then watches for a break, as after any key. `words` is how
   * many there were before the backspace.
   */
  private bringBackEmptied(words: number): void {
    if (this.grouping().current === '' && this.mistakes() === '' && this.sizes().length > 0) {
      this.landFlights();
      this.sizes.update((sizes) => sizes.slice(0, -1));
    }
    // A word reopened and finished again at once never left its place: it has nothing to fly from.
    this.watchForPause(this.sizes().length === words);
  }

  /** Starts a new game: no digits typed, back to the first spring. */
  protected restart(): void {
    this.stopWatching();
    this.landFlights();
    this.digits.set('');
    this.mistakes.set('');
    this.sizes.set([]);
    const ended = this.recorder.run();
    this.recorder.end();
    if (ended !== undefined) {
      this.earlierRuns.update((runs) => [...runs, ended]);
    }
  }

  /**
   * Finishes the group being typed as soon as the player breaks: where they usually do, within the trust horizon, or
   * where this run does, past it, its next digit timed as if typed now. Even a group with all its slots filled waits
   * for that: a next digit typed fast enough outweighs the break the earlier runs have there, and carries the group on.
   * Never while a mistake shows.
   */
  private watchForPause(flyNow = true): void {
    this.stopWatching();
    if (this.grouping().current === '' || this.mistakes() !== '') {
      return;
    }
    const check = (fly: boolean): void => {
      if (this.pausedLongEnough(this.plan().trusted)) {
        this.stopWatching();
        this.finishGroup(fly);
      }
    };
    this.stopWatching = this.timer.every(PAUSE_CHECK, () => {
      check(true);
    });
    check(flyNow);
  }

  /** Whether the group being typed, the player's own if `trusted`, ends before the next digit, were it typed now. */
  private pausedLongEnough(trusted: boolean): boolean {
    const times = this.recorder.run()?.times ?? [];
    const last = times.at(-1);
    return (
      last !== undefined &&
      groupEnds(
        this.fit([...times, last + this.recorder.waited()]),
        times.length,
        trusted,
        this.settings(),
      )
    );
  }

  /** Runs the break model over the earlier runs and this one, with the times given. */
  private fit(times: readonly number[]): BreakModel {
    const model = breakModel(this.finished(), times, this.settings(), this.mixture);
    this.mixture = model.mixture;
    return model;
  }

  /** Turns the group being typed into a word, its slots flying into it if `fly`. */
  private finishGroup(fly: boolean): void {
    const length = this.grouping().current.length;
    const firstPlace = this.digits().length - length + 1;
    const slots = fly ? this.slotsToFly(length) : [];
    this.sizes.update((sizes) => [...sizes, length]);
    if (slots.length === 0) {
      return;
    }
    // Measured once the new word is laid out. The typed digits finish scrolling down to it before the first slot lands.
    afterNextRender(
      {
        read: () => {
          const word = this.host.querySelector<HTMLElement>(
            `app-typed-digits .word[data-first-place="${String(firstPlace)}"]`,
          );
          if (word !== null) {
            const rise = this.typedDigits().scrollDown(FLIGHT_DURATION);
            this.flights = [
              ...this.flights.filter((flight) => flight.playState === 'running'),
              ...flyIntoWord(this.host, slots, word, rise),
            ];
          }
        },
      },
      { injector: this.injector },
    );
  }

  /** Snapshots of the slots a group about to close fills, unless flights are off. */
  private slotsToFly(length: number): ReturnType<typeof snapshotSlot>[] {
    if (!canFly(this.host)) {
      return [];
    }
    return Array.from(this.host.querySelectorAll('app-slots .slot'))
      .slice(0, length)
      .map((slot) => snapshotSlot(this.host, slot));
  }

  /** Ends the flights at once, before a word they fly into may be reopened. */
  private landFlights(): void {
    for (const flight of this.flights) {
      flight.cancel();
    }
    this.flights = [];
  }
}

/** How often to look whether the player has paused, in milliseconds. */
const PAUSE_CHECK = 50;

/** Whether slots can fly: not when the player prefers reduced motion, nor where the Web Animations API is missing. */
function canFly(element: HTMLElement): boolean {
  return (
    typeof element.animate === 'function' &&
    typeof matchMedia === 'function' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
