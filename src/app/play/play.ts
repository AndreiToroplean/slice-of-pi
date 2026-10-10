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
import { Background } from '../background/background';
import { FLIGHT_DURATION, flyIntoWord, snapshotSlot } from '../flight/flight';
import { DEFAULT_HINT, groupDigits } from '../groups/groups';
import { Keypad } from '../keypad/keypad';
import { keyColors, placeColors } from '../place-colors/place-colors';
import { Pause } from '../pause/pause';
import { RunRecorder } from '../runs/run-recorder';
import { KeypadKey } from '../keypad/keypad-layout';
import { SeasonHeader } from '../season-header/season-header';
import { seasonAt } from '../seasons/seasons';
import { Tweaks } from '../developer/tweaks';
import { Slots } from '../slots/slots';
import { TypedDigits } from '../typed-digits/typed-digits';

/**
 * The play screen: type the decimals of π on the keypad into the slots of the group being typed; each finished group
 * flies up to the typed digits as a word, as the seasons go by. Each typed digit takes the color its key showed.
 * Backspace deletes the last digit, reopening the last word when the slots are empty. Pausing offers to restart the game
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
      [digits]="grouping().current"
      [colors]="currentColors()"
      [hint]="hint"
    />
    <app-keypad class="keypad" [colors]="keyColors()" (keyPressed)="press($event)" />
    <app-pause [(paused)]="paused" (restart)="restart()" />
  `,
  styleUrl: './play.css',
})
export class Play {
  /** The decimals typed so far: one character per digit, so even a very long sequence takes little memory. */
  protected readonly digits = signal('');

  /** The colors tuned in developer mode, or the game's own. */
  private readonly tweaks = inject(Tweaks);

  /** Whether the game is paused: keys typed on a keyboard meanwhile don't count. */
  protected readonly paused = signal(false);

  protected readonly hint = DEFAULT_HINT;
  protected readonly grouping = computed(() => groupDigits(this.digits(), this.hint));

  /** The color of each typed place (`colors.md`). */
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
    seasonAt(this.digits().length, this.tweaks.seasonBackgrounds()),
  );

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly recorder = inject(RunRecorder);
  private readonly typedDigits = viewChild.required(TypedDigits);
  /** Slots flying into their word. */
  private flights: Animation[] = [];

  constructor() {
    // Ending the game, back to the main menu, ends the run.
    inject(DestroyRef).onDestroy(() => {
      this.recorder.end();
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
    this.recorder.record(key);
    if (key === 'backspace') {
      this.landFlights();
      this.digits.update((digits) => digits.slice(0, -1));
      return;
    }
    const words = this.grouping().words.length;
    const next = this.digits() + key;
    const closed = groupDigits(next, this.hint).words.at(words);
    const slots = closed === undefined ? [] : this.slotsToFly(closed.digits.length);
    this.digits.set(next);
    if (closed !== undefined && slots.length > 0) {
      // Measured once the new word is laid out. The typed digits finish scrolling down to it before the first slot lands.
      afterNextRender(
        {
          read: () => {
            const word = this.host.querySelector<HTMLElement>(
              `app-typed-digits .word[data-first-place="${String(closed.firstPlace)}"]`,
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
  }

  /** Starts a new game: no digits typed, back to the first spring. */
  protected restart(): void {
    this.landFlights();
    this.digits.set('');
    this.recorder.end();
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

/** Whether slots can fly: not when the player prefers reduced motion, nor where the Web Animations API is missing. */
function canFly(element: HTMLElement): boolean {
  return (
    typeof element.animate === 'function' &&
    typeof matchMedia === 'function' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
