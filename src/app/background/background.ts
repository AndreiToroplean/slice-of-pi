import { effect, inject, Service, signal, untracked } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ColorSpace, mixGradients } from '../colors/color-spaces';
import { Tweaks } from '../developer/tweaks';
import { BackgroundColors, seasonAt } from '../seasons/seasons';

/** How long the background takes to ease to new colors, in milliseconds. */
export const BACKGROUND_EASE = 800;

/**
 * The season background behind every screen (see `App`). It stays in place from screen to screen; each screen only
 * sets its colors, which the background eases towards.
 */
@Service()
export class Background {
  /** The background's colors, top then bottom: a new game's by default. */
  readonly colors = signal<BackgroundColors>(seasonAt(0).background);
  /** The color space the background blends its colors in, from top to bottom as through the seasons. */
  readonly colorSpace = inject(Tweaks).colorSpace;

  private readonly shownColors = signal<BackgroundColors>(this.colors());
  /**
   * The colors shown, easing towards {@link colors}. New colors restart the ease from wherever the colors are, so the
   * background glides along at any typing pace, trailing by a fraction of a second at most. The ease blends the colors
   * as the seasons do (see `mixGradients`), so that however far apart the colors are, as when leaving a game for the
   * main menu, the gradient never flips the way it turns round the color wheel, as it would in a CSS transition.
   */
  readonly shown = this.shownColors.asReadonly();

  private ease: {
    readonly from: BackgroundColors;
    readonly to: BackgroundColors;
    readonly space: ColorSpace;
    readonly start: number;
  } | null = null;
  private frame: number | null = null;

  constructor() {
    const meta = inject(Meta);
    // The browser's bars around the game blend into the top of the background.
    effect(() => {
      meta.updateTag({ name: 'theme-color', content: this.colors()[0] });
    });
    effect(() => {
      const to = this.colors();
      const space = this.colorSpace();
      untracked(() => {
        this.easeTo(to, space);
      });
    });
  }

  private easeTo(to: BackgroundColors, space: ColorSpace): void {
    const from = this.shownColors();
    if (from[0] === to[0] && from[1] === to[1]) {
      this.ease = null;
      return;
    }
    this.ease = { from, to, space, start: performance.now() };
    this.frame ??= requestAnimationFrame((time) => {
      this.step(time);
    });
  }

  private step(time: number): void {
    this.frame = null;
    if (this.ease === null) {
      return;
    }
    const { from, to, space, start } = this.ease;
    const progress = Math.min(1, Math.max(0, (time - start) / BACKGROUND_EASE));
    this.shownColors.set(
      progress === 1 ? to : mixGradients(from, to, 1 - (1 - progress) ** 3, space),
    );
    if (progress === 1) {
      this.ease = null;
      return;
    }
    this.frame = requestAnimationFrame((next) => {
      this.step(next);
    });
  }
}
