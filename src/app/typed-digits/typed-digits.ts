import {
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { Word } from '../groups/groups';
import { Glide, glideAt, glideEnd, glideTo } from './glide';

/** How long typing takes to scroll back down to the newest words, at most, in ms. */
export const SCROLL_DOWN_DURATION = 400;

/**
 * The typed digits, after a "π=3." word: each finished group is a word of joined tiles, and rows wrap between words like
 * text (`groupings.md` §3). The newest words are at the bottom and the oldest fade out at the top; the player scrolls
 * up to see them, and typing glides back down.
 */
@Component({
  selector: 'app-typed-digits',
  host: {
    role: 'region',
    'aria-label': 'Typed digits',
    tabindex: '0',
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

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly wordsElement = viewChild.required<ElementRef<HTMLElement>>('wordsElement');
  /** The scroll position's glide down to the newest words. */
  private glide: Glide | null = null;
  /** The glide of how much lower than their place the words are drawn, back to 0, as a new row slides in. */
  private lift: Glide | null = null;
  private frame: number | null = null;
  /** How tall the words were when last rendered, in pixels. */
  private height: number | null = null;

  constructor() {
    afterRenderEffect(() => {
      this.digits();
      untracked(() => {
        this.holdInPlace();
        this.scrollDown(SCROLL_DOWN_DURATION);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.frame !== null) {
        cancelAnimationFrame(this.frame);
      }
    });
  }

  /**
   * Glides down to the newest words, arriving within `duration` ms (sooner if already on its way), or at once if the
   * player prefers reduced motion. Returns how far the words have left to move up, in pixels, so that what flies to
   * them can aim for where they'll be.
   */
  scrollDown(duration: number): number {
    const now = performance.now();
    const time = prefersReducedMotion() ? 0 : duration;
    const lifted = this.lift === null ? 0 : glideAt(this.lift, now).position;
    if (this.lift !== null) {
      this.lift = glideTo(this.lift, lifted, 0, now, time);
    }
    const position = this.glide === null ? this.host.scrollTop : glideAt(this.glide, now).position;
    const bottom = this.bottom();
    if (this.glide !== null || Math.abs(bottom - position) >= 0.5) {
      this.glide = glideTo(this.glide, position, bottom, now, time);
    }
    this.step(now);
    return bottom - position + lifted;
  }

  /**
   * Keeps the words where they were on screen when a new row starts below them: the words grow at the bottom, which
   * pushes them all up at once. Drawing them lower by as much, then gliding them back up, slides the new row in.
   */
  private holdInPlace(): void {
    const height = this.wordsElement().nativeElement.offsetHeight;
    const grown = this.height === null ? 0 : height - this.height;
    this.height = height;
    if (grown <= 0 || prefersReducedMotion()) {
      return;
    }
    const now = performance.now();
    const state = this.lift === null ? { position: 0, speed: 0 } : glideAt(this.lift, now);
    this.lift = {
      from: state.position + grown,
      speed: state.speed,
      to: 0,
      start: now,
      duration: SCROLL_DOWN_DURATION,
    };
  }

  /** Where the scroll position is when scrolled all the way down. */
  private bottom(): number {
    const position = this.host.scrollTop;
    this.host.scrollTop = Number.MAX_SAFE_INTEGER;
    const bottom = this.host.scrollTop;
    this.host.scrollTop = position;
    return bottom;
  }

  private step(time: number): void {
    if (this.glide !== null) {
      this.host.scrollTop = glideAt(this.glide, time).position;
      if (time >= glideEnd(this.glide)) {
        this.glide = null;
      }
    }
    if (this.lift !== null) {
      const lifted = glideAt(this.lift, time).position;
      this.wordsElement().nativeElement.style.translate =
        lifted === 0 ? '' : `0 ${String(lifted)}px`;
      if (time >= glideEnd(this.lift)) {
        this.lift = null;
      }
    }
    if (this.glide !== null || this.lift !== null) {
      this.frame ??= requestAnimationFrame((next) => {
        this.frame = null;
        this.step(next);
      });
    }
  }
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
