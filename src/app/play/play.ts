import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { FLIGHT_DURATION, flyIntoWord, snapshotSlot } from '../flight/flight';
import { DEFAULT_HINT, groupDigits } from '../groups/groups';
import { Keypad } from '../keypad/keypad';
import { KeypadKey } from '../keypad/keypad-layout';
import { SeasonHeader } from '../season-header/season-header';
import { seasonAt } from '../seasons/seasons';
import { Slots } from '../slots/slots';
import { TypedDigits } from '../typed-digits/typed-digits';

/**
 * The play screen: type the decimals of π on the keypad into the slots of the group being typed; each finished group
 * flies up to the typed digits as a word, as the seasons go by. Backspace deletes the last digit, reopening the last
 * word when the slots are empty.
 */
@Component({
  selector: 'app-play',
  imports: [Keypad, SeasonHeader, Slots, TypedDigits],
  host: {
    '[style.--background-top]': 'season().background[0]',
    '[style.--background-bottom]': 'season().background[1]',
  },
  template: `
    <h1 class="visually-hidden">Slice of π</h1>
    <app-season-header [view]="season()" />
    <app-typed-digits [words]="grouping().words" [digits]="digits()" />
    <app-slots class="slots" [digits]="grouping().current" [hint]="hint" />
    <app-keypad class="keypad" (keyPressed)="press($event)" />
  `,
  styleUrl: './play.css',
})
export class Play {
  /** The decimals typed so far: one character per digit, so even a very long sequence takes little memory. */
  protected readonly digits = signal('');

  protected readonly hint = DEFAULT_HINT;
  protected readonly grouping = computed(() => groupDigits(this.digits(), this.hint));

  /** The season, and the background colors, after the places typed so far. */
  protected readonly season = computed(() => seasonAt(this.digits().length));

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly typedDigits = viewChild.required(TypedDigits);
  /** Slots flying into their word. */
  private flights: Animation[] = [];

  constructor() {
    const meta = inject(Meta);
    // The browser's bars around the game blend into the top of the background.
    effect(() => {
      meta.updateTag({ name: 'theme-color', content: this.season().background[0] });
    });
  }

  protected press(key: KeypadKey): void {
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
