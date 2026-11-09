import { DestroyRef } from '@angular/core';

/** How far each side of a candy button moves per unit of `--candy-breath` (see `breathe` in `styles.css`), in px. */
export const BREATH_REACH = 1;

/**
 * How much a candy button `width` px wide scales up per unit of `--candy-breath`, so that its sides move by
 * `BREATH_REACH` each, however wide it is: a narrow one scales up more, a wide one less, evenly on both axes, so that
 * what it says and its corners keep their shape. Nothing before it's laid out.
 */
export function breathStep(width: number): number {
  return width > 0 ? (2 * BREATH_REACH) / width : 0;
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
