import {
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Word } from '../../../game/grouping/groups';
import { FIRST_LANDING } from '../flight/flight';
import { Glide, glideAt, glideEnd, glideTo } from './glide';

/** How long typing takes to scroll back to the newest words, once the player has scrolled away, at most, in ms. */
export const SCROLL_BACK_DURATION = 400;

/**
 * The typed digits on the tape, after a "π=3." word: each finished group is a word of joined tiles, on one row that
 * scrolls left as words come onto it, the oldest fading out on the left. The tape makes room for a word as it flies
 * onto it, done scrolling when its first digit lands. A word taken off it, back into the slots, leaves its room behind,
 * so that taking it off and putting it back doesn't move the tape: only the next word taken off scrolls it back, by the
 * room the first one left. The player scrolls right to see older words, which fades out the newest on the right too,
 * and typing scrolls back (see `scrollToEnd`).
 */
@Component({
  selector: 'app-typed-digits',
  host: {
    role: 'region',
    'aria-label': 'Typed digits',
    tabindex: '0',
    '[class.hidden-left]': 'hiddenLeft()',
    '[class.hidden-right]': 'hiddenRight()',
    '(scroll)': 'scrolled()',
  },
  template: `
    <div #wordsElement class="words" aria-hidden="true">
      <span class="lead"
        ><span class="tile">π</span><span class="tile shade">=</span><span class="tile">3</span
        ><span class="tile shade">.</span></span
      >
      @for (word of words(); track word.firstPlace) {
        <span class="word" [attr.data-first-place]="word.firstPlace">
          @for (digit of word.digits; track $index) {
            <span class="tile" [style.--place-color]="colors()[word.firstPlace - 1 + $index]">{{
              digit
            }}</span>
          }
        </span>
      }
    </div>
    <p class="visually-hidden">{{ summary() }}</p>
  `,
  styleUrl: './typed-digits.css',
})
export class TypedDigits {
  /** The finished groups, in order. */
  readonly words = input.required<readonly Word[]>();
  /** The digits typed so far, including those of the group being typed. */
  readonly digits = input.required<string>();
  /** The place colors of the digits typed so far: place p's is at index p - 1. */
  readonly colors = input.required<readonly string[]>();

  protected readonly summary = computed(() => {
    const digits = this.digits();
    return digits === ''
      ? 'No digits typed yet.'
      : `${String(digits.length)} digits typed, the last one is ${digits.slice(-1)}.`;
  });

  /** Whether words are hidden past the left edge, which fades out. */
  protected readonly hiddenLeft = signal(false);
  /** Whether words are hidden past the right edge, scrolled away from, which fades out. */
  protected readonly hiddenRight = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly wordsElement = viewChild.required<ElementRef<HTMLElement>>('wordsElement');
  /** The scroll position's glide to the newest words. */
  private glide: Glide | null = null;
  private frame: number | null = null;
  /** Where the tape was last scrolled to, in pixels, by the player or by a glide. */
  private position = 0;
  /** How long the tape is held, in pixels from the start of the words: their end, or past it, to leave room. */
  private held = 0;
  /** The first place of the last word taken off, which the room left is for. */
  private taken: number | undefined;
  /** The words, and where they ended, in pixels, when last rendered. */
  private last: { readonly words: readonly Word[]; readonly end: number } | null = null;
  /** Room shown past the room left, for the tape to glide back from where it was, rather than jump, as it shortens. */
  private extra = 0;

  constructor() {
    // On each word, which comes on or off the tape after the key that typed its last digit, if any.
    afterRenderEffect(() => {
      const words = this.words();
      untracked(() => {
        const added = this.last !== null && words.length > this.last.words.length;
        this.leaveRoom(words);
        this.scrollToEnd(added ? FIRST_LANDING : SCROLL_BACK_DURATION);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.frame !== null) {
        cancelAnimationFrame(this.frame);
      }
    });
  }

  /**
   * Glides to the newest words, arriving within `duration` ms (sooner if already on its way), or at once if the player
   * prefers reduced motion. Returns how far the words have left to move left, in pixels, so that what flies to them can
   * aim for where they'll be.
   */
  scrollToEnd(duration: number): number {
    const now = performance.now();
    const time = prefersReducedMotion() ? 0 : duration;
    const position = this.glide === null ? this.host.scrollLeft : glideAt(this.glide, now).position;
    const end = this.end();
    if (this.glide !== null || Math.abs(end - position) >= 0.5) {
      this.glide = glideTo(this.glide, position, end, now, time);
    }
    this.step(now);
    return end - position;
  }

  /** Notes where the player, or a glide, scrolled the tape to, and which of its edges hide words. */
  protected scrolled(): void {
    this.position = this.host.scrollLeft;
    const end = this.host.scrollWidth - this.host.clientWidth;
    this.hiddenLeft.set(this.position > 0.5);
    this.hiddenRight.set(end - this.position > this.room() + this.extra + 0.5);
  }

  /**
   * Leaves room at the end of `words`, as they're rendered, for the last word taken off: as much as it took up, so that
   * the tape keeps its length, even as that word comes back shorter, or is taken off again. Taking another word off
   * drops that room, and leaves the room for that one; taking several off at once leaves none. Words put on take up
   * the room before making more. Then keeps the tape where it was, with more room, if it got too short for it to stay.
   */
  private leaveRoom(words: readonly Word[]): void {
    const element = this.wordsElement().nativeElement;
    const end = wordsEnd(element);
    const last = this.last;
    const lastWord = last?.words.at(-1);
    if (
      last === null ||
      lastWord === undefined ||
      words.some(
        (word) => word.firstPlace === lastWord.firstPlace && word.digits === lastWord.digits,
      )
    ) {
      this.held = Math.max(this.held, end);
    } else if (words.length < last.words.length - 1) {
      this.held = end;
      this.taken = undefined;
    } else if (this.taken === lastWord.firstPlace) {
      this.held = Math.max(this.held, end);
    } else {
      this.held = Math.max(end, last.end);
      this.taken = lastWord.firstPlace;
    }
    this.last = { words, end };
    this.showRoom(0);
    this.host.scrollLeft = this.position;
    this.showRoom(Math.max(0, this.position - this.host.scrollLeft));
    this.host.scrollLeft = this.position;
  }

  /** Shows the room left, and `extra` more. */
  private showRoom(extra: number): void {
    this.extra = extra;
    this.wordsElement().nativeElement.style.setProperty(
      '--room',
      `${String(this.room() + extra)}px`,
    );
  }

  /** The room left at the end of the words, in pixels. */
  private room(): number {
    return this.last === null ? 0 : this.held - this.last.end;
  }

  /** Where the scroll position is when scrolled all the way to the end, without the extra room. */
  private end(): number {
    const position = this.host.scrollLeft;
    this.host.scrollLeft = Number.MAX_SAFE_INTEGER;
    const end = this.host.scrollLeft;
    this.host.scrollLeft = position;
    return Math.max(0, end - this.extra);
  }

  private step(time: number): void {
    if (this.glide !== null) {
      this.host.scrollLeft = glideAt(this.glide, time).position;
      if (time >= glideEnd(this.glide)) {
        this.glide = null;
        this.showRoom(0);
      }
    }
    this.scrolled();
    if (this.glide !== null) {
      this.frame ??= requestAnimationFrame((next) => {
        this.frame = null;
        this.step(next);
      });
    }
  }
}

/** Where the last of `words` ends, in pixels from their start, with the space after it. */
function wordsEnd(words: HTMLElement): number {
  const last = words.lastElementChild;
  return last === null
    ? 0
    : last.getBoundingClientRect().right - words.getBoundingClientRect().left;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
