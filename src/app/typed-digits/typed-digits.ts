import {
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  untracked,
} from '@angular/core';
import { Word } from '../groups/groups';
import { Glide, glideAt, glideEnd, glideTo } from './glide';

/** How long typing takes to scroll back down to the newest words, at most, in ms. */
export const SCROLL_DOWN_DURATION = 400;

/**
 * The typed digits, after a "3." word: each finished group is a word of joined tiles, and rows wrap between words like
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
    <div class="words" aria-hidden="true">
      <span class="lead"><span class="tile">3</span><span class="tile">.</span></span>
      @for (word of words(); track word.firstPlace) {
        <span class="word" [attr.data-first-place]="word.firstPlace">
          @for (digit of word.digits; track $index) {
            <span class="tile">{{ digit }}</span>
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

  protected readonly summary = computed(() => {
    const digits = this.digits();
    return digits === ''
      ? 'No digits typed yet.'
      : `${String(digits.length)} digits typed, the last one is ${digits.slice(-1)}.`;
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private glide: Glide | null = null;
  private frame: number | null = null;

  constructor() {
    afterRenderEffect(() => {
      this.digits();
      untracked(() => this.scrollDown(SCROLL_DOWN_DURATION));
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
    const position = this.glide === null ? this.host.scrollTop : glideAt(this.glide, now).position;
    const bottom = this.bottom();
    if (this.glide === null && Math.abs(bottom - position) < 0.5) {
      return 0;
    }
    this.glide = glideTo(this.glide, position, bottom, now, prefersReducedMotion() ? 0 : duration);
    this.step(now);
    return bottom - position;
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
    const glide = this.glide;
    if (glide === null) {
      return;
    }
    this.host.scrollTop = glideAt(glide, time).position;
    if (time >= glideEnd(glide)) {
      this.glide = null;
    } else {
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
