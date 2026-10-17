import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, inject, signal } from '@angular/core';
import { DeveloperMode } from './developer-mode';

/** How many taps in a row turn developer mode on or off. */
export const TAPS = 10;
/** From which tap on the taps are counted out loud. */
export const SHOWN_FROM = 5;
/** How long after a tap the next one may come, before the taps in a row are given up. */
export const TAP_GAP_MS = 1000;
/** How long a closing message stays on screen: once developer mode was turned on or off, or the taps were given up. */
export const MESSAGE_MS = 3000;

/** What the taps say along the way, depending on whether they turn developer mode on or off. */
export const MESSAGES = {
  on: {
    counting: 'Becoming a developer…',
    done: "Congrats, you're a developer!",
    /** When the taps stop short, by how many taps there were. */
    stopped: {
      5: 'Just looking? Fair enough.',
      6: 'Cold feet? The code will wait.',
      7: 'Seven taps and a change of heart.',
      8: 'You almost had the keys to the kingdom.',
      9: 'Oh, you were so close!',
    },
  },
  off: {
    counting: 'Forgetting all the code…',
    done: "You're a mere player again. Enjoy the digits!",
    stopped: {
      5: 'Still a developer. Phew.',
      6: "The code isn't going anywhere.",
      7: 'Second thoughts? Good instinct.',
      8: 'That was nearly a career change.',
      9: 'Oh man, good thing you turned around. That would have been such a shame.',
    },
  },
} as const;

/**
 * The secret way to turn developer mode on and off, on an element (the main menu's game icon): tap it ten times in a
 * row, each tap within {@link TAP_GAP_MS} of the last. From the fifth tap on, a message says what's happening; the tenth
 * turns developer mode on, or back off, and says so. Stopping short of ten gives up, with a word about it.
 */
@Directive({
  selector: '[appDeveloperTaps]',
  exportAs: 'developerTaps',
  host: { '(click)': 'tap()' },
})
export class DeveloperTaps {
  private readonly developerMode = inject(DeveloperMode);
  private readonly window = inject(DOCUMENT).defaultView;

  /** What to say, or what was last said, once it's no longer {@link shown}, so that it can fade out. */
  readonly message = signal('');
  /** Whether the message is shown. */
  readonly shown = signal(false);

  /** The taps in a row so far. */
  private count = 0;
  /** Whether the taps in a row turn developer mode on, rather than off. */
  private turnsOn = true;
  private gapTimer: ReturnType<typeof setTimeout> | undefined;
  private messageTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.gapTimer);
      clearTimeout(this.messageTimer);
    });
  }

  protected tap(): void {
    clearTimeout(this.gapTimer);
    if (this.count === 0) {
      this.turnsOn = !this.developerMode.enabled();
    }
    this.count++;
    const messages = MESSAGES[this.turnsOn ? 'on' : 'off'];
    if (this.count === TAPS) {
      this.count = 0;
      void this.developerMode.set(this.turnsOn);
      this.vibrate();
      this.close(messages.done);
      return;
    }
    if (this.count >= SHOWN_FROM) {
      clearTimeout(this.messageTimer);
      this.message.set(messages.counting);
      this.shown.set(true);
    }
    this.gapTimer = setTimeout(() => {
      this.giveUp();
    }, TAP_GAP_MS);
  }

  /** The taps stopped short: says a word about it if they were being counted. */
  private giveUp(): void {
    const count = this.count;
    this.count = 0;
    if (count >= SHOWN_FROM) {
      const stopped: Readonly<Record<number, string>> =
        MESSAGES[this.turnsOn ? 'on' : 'off'].stopped;
      this.close(stopped[count] ?? '');
    }
  }

  /** Shows a closing message for a while. */
  private close(text: string): void {
    clearTimeout(this.messageTimer);
    this.message.set(text);
    this.shown.set(true);
    this.messageTimer = setTimeout(() => {
      this.shown.set(false);
    }, MESSAGE_MS);
  }

  private vibrate(): void {
    const navigator = this.window?.navigator;
    if (navigator !== undefined && 'vibrate' in navigator) {
      navigator.vibrate(60);
    }
  }
}
