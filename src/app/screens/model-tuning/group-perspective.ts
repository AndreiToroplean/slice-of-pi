import { Component, computed, inject, input, signal } from '@angular/core';
import { Carousel } from '../../ui/carousel';
import { GroupList, ShownGroup } from '../your-runs/group-list';
import { MyGroupings } from './my-groupings';
import type { Plot, Range } from '../your-runs/views/plot';
import { PlotView } from '../your-runs/views/plot-view';

/**
 * The groups the break model makes of the runs, beside what it makes of them along the places and at
 * one place on top of Model Tuning, one after the other: the game's groups, the player's own as they type them, which the
 * break model is fitted to, then the views along the digits of a group (`group-views.ts`).
 */
@Component({
  selector: 'app-group-perspective',
  imports: [Carousel, GroupList, PlotView],
  template: `
    <app-carousel label="The groups of the break model, step by step">
      <section class="view">
        <div class="heading">
          <h3>The game’s groups</h3>
          <span class="step">1/{{ count() }}</span>
        </div>
        <app-group-list [groups]="groups()" [rows]="undefined" />
        <p class="caption">
          The groups the game plays, cut where your runs usually break: dotted past the trust
          horizon.
        </p>
      </section>
      <section class="view">
        <div class="heading">
          <h3><label for="my-groupings">Your groupings</label></h3>
          <span class="step">2/{{ count() }}</span>
        </div>
        <textarea
          id="my-groupings"
          spellcheck="false"
          autocomplete="off"
          aria-describedby="my-groupings-status"
          [value]="myGroupings.text()"
          [attr.aria-invalid]="myGroupings.mistake() !== undefined"
          (input)="type($event)"
        ></textarea>
        <p
          id="my-groupings-status"
          class="caption"
          [class.error]="myGroupings.mistake() !== undefined"
        >
          @if (myGroupings.mistake(); as wrong) {
            At place {{ wrong.place }}, π goes {{ wrong.before.length < wrong.place - 1 ? '…' : ''
            }}{{ wrong.before }}<u>{{ wrong.expected }}</u
            >.
          } @else {
            The decimals of π as you group them, a space between groups: Fit to My Groupings fits
            the break model to them.
          }
        </p>
      </section>
      @for (plot of plots(); track plot.title; let index = $index) {
        <app-plot-view
          class="view"
          [plot]="plot"
          [step]="index + 3 + '/' + count()"
          [(zoom)]="groupZoom"
        />
      }
    </app-carousel>
  `,
  styles: `
    :host {
      display: grid;
      /* As narrow as whatever holds it, however wide its carousel's steps side by side. */
      min-width: 0;
    }

    /* Out to the edges of the card, so that each step slides in from them, as on the other sides. */
    app-carousel {
      margin: 0 calc(-1 * var(--space-3));
    }

    .view {
      flex: 0 0 100%;
      display: grid;
      align-content: start;
      gap: 0.375rem;
      padding: 0 var(--space-3);
      box-sizing: border-box;
      scroll-snap-align: start;
    }

    /* A list of groups: it fills the height the plots give the card, between the heading and the caption. */
    section.view {
      grid-template-rows: auto minmax(0, 1fr) auto;
      align-content: stretch;
    }

    .heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
    }

    h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
    }

    p {
      margin: 0;
    }

    .step,
    .caption {
      font-size: 0.75rem;
      opacity: 0.75;
    }

    .caption.error {
      color: var(--candy-danger);
      font-weight: 600;
      opacity: 1;
    }

    u {
      text-decoration-thickness: 0.125rem;
      text-underline-offset: 0.2em;
    }

    /* As tall as the step leaves it, never taller for what's typed in it. */
    textarea {
      contain: size;
      min-height: 4rem;
      box-sizing: border-box;
      width: 100%;
      padding: 0.5rem 0.625rem;
      border: 1px solid rgb(30 20 60 / 20%);
      border-radius: 0.75rem;
      background: white;
      color: inherit;
      font-family: var(--font-digits);
      font-size: 0.875rem;
      letter-spacing: 0.04em;
      resize: none;

      &:focus-visible {
        outline: 0.1875rem solid var(--focus-ring);
        outline-offset: 0.125rem;
      }

      &[aria-invalid='true'] {
        border-color: var(--candy-danger);
      }
    }
  `,
})
export class GroupPerspective {
  /** The groups the game plays. */
  readonly groups = input.required<readonly ShownGroup[]>();
  /** The views along the digits of a group. */
  readonly plots = input<readonly Plot[]>([]);

  /** The window of the digits of a group the steps show, zoomed into on any of them: all of them if undefined. */
  protected readonly groupZoom = signal<Range | undefined>(undefined);
  protected readonly myGroupings = inject(MyGroupings);
  /** How many steps the carousel has: the two lists of groups, then the plots. */
  protected readonly count = computed(() => this.plots().length + 2);

  protected type(event: Event): void {
    const field = event.target as HTMLTextAreaElement;
    this.myGroupings.set(field.value);
    if (field.value !== this.myGroupings.text()) {
      field.value = this.myGroupings.text();
    }
  }
}
