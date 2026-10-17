import { Service, signal } from '@angular/core';

/**
 * Which grouping settings developer mode shows on the charts of Your Runs, as lines where they act (see `GUIDE_COLORS` in
 * `model-views.ts`): only while the page is open, never saved.
 */
@Service()
export class ChartGuides {
  readonly shown = signal<ReadonlySet<string>>(new Set());

  /** Shows a setting on the charts, or stops showing it. */
  toggle(key: string): void {
    this.shown.update((shown) => {
      const next = new Set(shown);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }
}
