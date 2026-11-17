import {
  afterRenderEffect,
  Component,
  contentChildren,
  DestroyRef,
  Directive,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';

/**
 * A tab's panel, in a strip of them (see {@link TabPanels}): `appTabPanel` is the value of its tab. Only the chosen one
 * can take the focus or be read by screen readers; the others are only seen, as the player swipes past them.
 */
@Directive({
  selector: '[appTabPanel]',
  host: {
    role: 'tabpanel',
    // Side by side, each as wide as the strip, snapping into view.
    '[style.flex]': '"0 0 100%"',
    '[style.min-width]': '0',
    '[style.scroll-snap-align]': '"start"',
    '[style.scroll-snap-stop]': '"always"',
    '[id]': 'panels.panels() + "-" + value()',
    '[attr.aria-labelledby]': 'panels.panels() + "-tab-" + value()',
    '[attr.inert]': 'panels.value() === value() ? null : ""',
  },
})
export class TabPanel {
  readonly value = input.required<string>({ alias: 'appTabPanel' });
  readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly panels = inject<TabPanels<string>>(TabPanels);
}

/**
 * The panels of a strip of tabs (`Segmented`, given the same `panels`), side by side, one in view: choosing a tab
 * slides its panel in, and swiping sideways to another panel, which snaps into place, chooses its tab. It's as tall as
 * the panel in view, unless it `fills` the height it's given, its panels stretched to it.
 */
@Component({
  selector: 'app-tab-panels',
  host: {
    '[class.fills]': 'fills()',
    '(scrollend)': 'settle()',
    '(scroll)': 'scrolled()',
  },
  template: '<ng-content />',
  styles: `
    :host {
      display: flex;
      align-items: start;
      overflow-x: auto;
      overflow-y: hidden;
      overscroll-behavior-x: contain;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
      scroll-behavior: smooth;
      transition: height 0.25s var(--ease);
    }

    :host(.fills) {
      align-items: stretch;
    }

    @media (prefers-reduced-motion: reduce) {
      :host {
        scroll-behavior: auto;
        transition: none;
      }
    }
  `,
})
export class TabPanels<T extends string> {
  /** The ids its tabs and panels share, as `Segmented`'s `panels`. */
  readonly panels = input.required<string>();
  /** The value of the chosen tab, whose panel is in view. */
  readonly value = model.required<T>();
  /** Whether it takes the height it's given, rather than the panel in view's. */
  readonly fills = input(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /**
   * The timeline of its panels' scrolling, from the first in view to the last, where the browser has scroll-driven
   * animations: for its tabs' pill to follow it in the same frame (`Segmented`'s `follows`).
   */
  readonly timeline =
    typeof ScrollTimeline === 'undefined'
      ? undefined
      : new ScrollTimeline({ source: this.host, axis: 'x' });
  /**
   * How far its panels are scrolled, in panels: 1 when the second is in view, 1.5 halfway from it to the third. It
   * follows a swipe as it goes only where there's no {@link timeline}; otherwise, it's set as they settle.
   */
  readonly position = signal(0);

  private readonly window = inject(DOCUMENT).defaultView;
  private readonly tabs = contentChildren(TabPanel);
  /** Whether a panel is in view yet, from which the next one then slides in. */
  private placed = false;
  /** Settles on the panel swiped to, a moment after the last scroll, where the browser doesn't tell when scrolling ends. */
  private settling: ReturnType<typeof setTimeout> | undefined;
  private readonly resizes =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(() => {
          this.fit();
        });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.resizes?.disconnect();
      clearTimeout(this.settling);
    });
    afterRenderEffect(() => {
      const chosen = this.chosen();
      if (chosen === undefined) {
        return;
      }
      this.resizes?.disconnect();
      this.resizes?.observe(chosen);
      this.fit();
      // Sliding there, as its style says, but the first time, in place at once.
      this.host.style.scrollBehavior = this.placed ? '' : 'auto';
      this.host.scrollLeft =
        this.tabs().findIndex(({ element }) => element === chosen) * this.host.clientWidth;
      this.host.style.scrollBehavior = '';
      if (!this.placed) {
        this.follow();
      }
      this.placed = true;
    });
  }

  /** Chooses the tab of the panel scrolling has settled on. */
  protected settle(): void {
    clearTimeout(this.settling);
    const width = this.host.clientWidth;
    const panel = width > 0 ? this.tabs()[Math.round(this.host.scrollLeft / width)] : undefined;
    if (panel !== undefined) {
      this.value.set(panel.value() as T);
    }
    this.follow();
  }

  /**
   * Follows the scrolling, unless the browser animates what follows it (see {@link timeline}), and where it doesn't tell
   * when scrolling ends, settles once it has stopped for a moment.
   */
  protected scrolled(): void {
    if (this.timeline === undefined) {
      this.follow();
    }
    if (this.window !== null && 'onscrollend' in this.window) {
      return;
    }
    clearTimeout(this.settling);
    this.settling = setTimeout(() => {
      this.settle();
    }, 150);
  }

  /** Notes how far its panels are scrolled. */
  private follow(): void {
    const width = this.host.clientWidth;
    this.position.set(width > 0 ? this.host.scrollLeft / width : 0);
  }

  /** The chosen tab's panel. */
  private chosen(): HTMLElement | undefined {
    return this.tabs().find((panel) => panel.value() === this.value())?.element;
  }

  /** As tall as the panel in view, unless it fills its height. */
  private fit(): void {
    const chosen = this.chosen();
    this.host.style.height =
      this.fills() || chosen === undefined ? '' : `${String(chosen.offsetHeight)}px`;
  }
}
