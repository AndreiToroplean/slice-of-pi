import { DestroyRef } from '@angular/core';
import { GAME_VALUES } from '../game-values';

/**
 * How far each side of a candy button moves as it breathes out all the way, in CSS pixels, however wide it is, as
 * `--breath` (see `breathe` in `styles.css` and `candy.css`).
 */
export const BREATH = GAME_VALUES.breath;
/** The most a developer can make the buttons breathe, in CSS pixels. */
export const MAX_BREATH = 12;

/** Whether a value is how far buttons can breathe: from none to {@link MAX_BREATH}, in half pixels. */
export function isBreath(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value * 2) && value >= 0 && value <= MAX_BREATH
  );
}

/**
 * How much a candy button `width` px wide scales up for each pixel its sides move, as `--candy-breath-step`: a narrow
 * one scales up more, a wide one less, evenly on both axes, so that what it says and its corners keep their shape.
 * Nothing before it's laid out.
 */
export function breathStep(width: number): number {
  return width > 0 ? 2 / width : 0;
}

/** One observer for every button, which sets each one's step as its width changes. */
let observer: ResizeObserver | undefined;

/** Keeps an element's `--candy-breath-step` to its width (see `breathStep`), until it's destroyed. */
export function breatheEvenly(element: HTMLElement, destroyRef: DestroyRef): void {
  if (typeof ResizeObserver === 'undefined') {
    return;
  }
  observer ??= new ResizeObserver((entries) => {
    for (const entry of entries) {
      const width = entry.borderBoxSize[0]?.inlineSize ?? entry.contentRect.width;
      (entry.target as HTMLElement).style.setProperty(
        '--candy-breath-step',
        String(breathStep(width)),
      );
    }
  });
  const watching = observer;
  watching.observe(element);
  destroyRef.onDestroy(() => {
    watching.unobserve(element);
  });
}
