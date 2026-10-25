import { Component, ElementRef, input, viewChild } from '@angular/core';

/**
 * Views side by side, shown one at a time: swiped through, scrolled through with the arrow keys, or stepped through with
 * the arrow buttons on its sides, which go around from the last view to the first and back. Each view, given as its
 * content, takes the carousel's whole width and snaps to its start.
 */
@Component({
  selector: 'app-carousel',
  template: `
    <div
      #track
      class="track"
      role="group"
      tabindex="0"
      [attr.aria-label]="label()"
      (scrollend)="target = undefined"
    >
      <ng-content />
    </div>
    <button type="button" class="arrow previous" title="Previous" (click)="go(-1)">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
    </button>
    <button type="button" class="arrow next" title="Next" (click)="go(1)">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
    </button>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      /* As narrow as whatever holds it, however wide its views side by side. */
      min-width: 0;
    }

    .track {
      display: flex;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;

      &:focus-visible {
        outline: 0.1875rem solid var(--ink);
        outline-offset: -0.1875rem;
      }
    }

    @media (prefers-reduced-motion: no-preference) {
      .track {
        scroll-behavior: smooth;
      }
    }

    /* Floating over the edges of the views, halfway down. */
    .arrow {
      position: absolute;
      top: 50%;
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: var(--frost-pressed);
      color: inherit;
      cursor: pointer;
      translate: 0 -50%;

      &.previous {
        left: 0.25rem;
      }

      &.next {
        right: 0.25rem;
      }

      & svg {
        width: 1rem;
        height: 1rem;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.4;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      &:focus-visible {
        outline: 0.1875rem solid var(--focus-ring);
        outline-offset: 0.125rem;
      }
    }
  `,
})
export class Carousel {
  /** What the views are, for screen readers. */
  readonly label = input.required<string>();

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  /** The view an arrow button is scrolling to, until it's there, so that pressing again steps on from it. */
  protected target: number | undefined;

  /** Shows the view a step away from the one shown, going around past either end. */
  protected go(step: number): void {
    const track = this.track().nativeElement;
    const width = track.clientWidth;
    if (width === 0) {
      return;
    }
    const count = Math.round(track.scrollWidth / width);
    const shown = this.target ?? Math.round(track.scrollLeft / width);
    this.target = (((shown + step) % count) + count) % count;
    track.scrollTo({ left: this.target * width });
  }
}
