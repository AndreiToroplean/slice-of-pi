import { Component, computed, input, model, signal } from '@angular/core';
import type { Steps } from '../../game/grouping/break-models/steps';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { Carousel } from '../../ui/carousel';
import { placeAnalysis } from './views/place-views';
import type { Range } from './views/plot';
import { PlotView } from './views/plot-view';

/** How many of π's digits show on each side of the place. */
const CONTEXT = 6;

/**
 * In developer mode, what the break model makes of one place across the runs (`place-views.ts`), beside what it makes of
 * the runs along the places on top of Your Runs: the place, between two digits of π, stepped through one at a time or
 * from one usual break spot to the next, then, one after the other, whether it's a break and why, what each run says
 * there, step by step, and every run there in a table. Tapping a chart along the places picks the place too.
 */
@Component({
  selector: 'app-place-perspective',
  imports: [Carousel, PlotView],
  template: `
    <div class="picker" role="group" aria-label="The place">
      <button
        type="button"
        class="round"
        aria-label="The usual break spot before"
        [disabled]="previousBreak() === undefined"
        (click)="go(previousBreak())"
      >
        «
      </button>
      <button
        type="button"
        class="round"
        aria-label="The place before"
        [disabled]="place() <= 1"
        (click)="go(place() - 1)"
      >
        ‹
      </button>
      <h3>
        <span>Places {{ place() }} | {{ place() + 1 }}</span
        >{{ ' '
        }}<span class="verdict" [class.breaks]="analysis().breaks">{{
          analysis().breaks ? 'Break' : 'No break'
        }}</span>
      </h3>
      <button
        type="button"
        class="round"
        aria-label="The place after"
        [disabled]="place() >= last()"
        (click)="go(place() + 1)"
      >
        ›
      </button>
      <button
        type="button"
        class="round"
        aria-label="The usual break spot after"
        [disabled]="nextBreak() === undefined"
        (click)="go(nextBreak())"
      >
        »
      </button>
    </div>
    <app-carousel label="The break model at one place, step by step">
      <section class="view">
        <div class="heading">
          <h4>Verdict</h4>
          <span class="step">1/{{ count() }}</span>
        </div>
        <div class="scroll" tabindex="0" role="region" aria-label="Verdict">
          <p class="digits" aria-label="The digits on each side">
            <span>{{ digits().before }}</span
            ><b [class.breaks]="analysis().breaks">|</b><span>{{ digits().after }}</span>
          </p>
          <dl class="facts">
            @for (fact of analysis().facts; track fact.label) {
              <div>
                <dt>{{ fact.label }}</dt>
                <dd>{{ fact.value }}</dd>
              </div>
            }
          </dl>
        </div>
      </section>
      @for (plot of analysis().plots; track plot.title; let index = $index) {
        <app-plot-view
          class="view"
          [plot]="plot"
          [step]="index + 2 + '/' + count()"
          [(zoom)]="runZoom"
        />
      }
      <section class="view">
        <div class="heading">
          <h4>Every run here</h4>
          <span class="step">{{ count() }}/{{ count() }}</span>
        </div>
        <div class="scroll" tabindex="0" role="region" aria-label="Every run here">
          <table>
            <thead>
              <tr>
                @for (column of analysis().table.columns; track column) {
                  <th scope="col">{{ column }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of analysis().table.rows; track row.run) {
                <tr [class.picked]="row.picked" [class.breaks]="row.breaks">
                  @for (cell of row.cells; track $index) {
                    <td>{{ cell }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </app-carousel>
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.375rem;
      /* As narrow as whatever holds it, however wide its carousel's steps side by side. */
      min-width: 0;
    }

    .picker {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .round {
      flex: none;
      font-size: 1rem;
      line-height: 1;
    }

    h3,
    h4 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
    }

    h3 {
      flex: 1;
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: var(--space-2);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .verdict {
      padding: 0.125rem 0.5rem;
      border-radius: 0.75rem;
      background: var(--ink);
      color: white;
      font-size: 0.75rem;
    }

    .verdict.breaks {
      background: var(--chart-break);
    }

    /* Out to the edges of the card, so that each step slides in from them, as on the other side. */
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

    /* A step that isn't a plot: what scrolls in it fills the height the plots give the card. */
    section.view {
      grid-template-rows: auto minmax(0, 1fr);
      align-content: stretch;
    }

    .heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
    }

    p {
      margin: 0;
    }

    .step,
    .caption {
      font-size: 0.75rem;
      opacity: 0.75;
    }

    .axis {
      display: flex;
      justify-content: space-between;
      font-size: 0.875rem;
      opacity: 0.85;
    }

    /*
     * As tall as the step leaves it, never taller for what's in it: what doesn't fit scrolls on its own, so that the
     * card keeps its height.
     */
    .scroll {
      contain: size;
      min-height: 4rem;
      overflow: auto;
      /* Only up and down: past its edge, a swipe sideways goes on to the carousel. */
      overscroll-behavior-y: contain;

      &:focus-visible {
        outline: 0.1875rem solid var(--focus-ring);
        outline-offset: -0.1875rem;
      }
    }

    .digits {
      font-family: var(--font-digits);
      font-size: 1.125rem;
      letter-spacing: 0.08em;
      text-align: center;

      & b {
        margin: 0 0.25rem;
        opacity: 0.35;
      }

      & b.breaks {
        color: var(--chart-break);
        opacity: 1;
      }
    }

    .facts {
      display: grid;
      gap: 0.25rem;
      margin: 0.25rem 0 0;
      font-size: 0.8125rem;

      & div {
        display: grid;
        grid-template-columns: 6.5rem 1fr;
        gap: var(--space-2);
      }

      & dt {
        font-weight: 600;
      }

      & dd {
        margin: 0;
        font-variant-numeric: tabular-nums;
      }
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    /* The header stays as the runs scroll under it. */
    th {
      position: sticky;
      top: 0;
      background: white;
      text-align: left;
    }

    th,
    td {
      padding: 0.125rem 0.375rem 0.125rem 0;
    }

    td:not(:first-child),
    th:not(:first-child) {
      text-align: right;
    }

    tr.breaks td:first-child {
      box-shadow: inset 0.1875rem 0 var(--chart-break);
      padding-left: 0.375rem;
    }

    tr.picked {
      font-weight: 700;
    }
  `,
})
export class PlacePerspective {
  /** The steps of the break model over the runs counted. */
  readonly steps = input.required<Steps>();
  /** The place: the boundary before the digit at this index, from 1. */
  readonly place = model.required<number>();
  /** The digits of the longest run, so that the last place is before its last digit. */
  readonly digitCount = input.required<number>();
  /** The runs picked, by their index in the steps' runs. */
  readonly picked = input<readonly number[]>([]);
  /** What each run is called, by its index in the steps' runs. */
  readonly titles = input<readonly string[]>([]);

  /** The window of the runs the steps across them show, zoomed into on any of them: all of them if undefined. */
  protected readonly runZoom = signal<Range | undefined>(undefined);
  protected readonly last = computed(() => Math.max(1, this.digitCount() - 1));
  protected readonly analysis = computed(() =>
    placeAnalysis({
      model: this.steps(),
      place: this.place(),
      picked: this.picked(),
      titles: this.titles(),
    }),
  );
  /** How many steps the carousel has: the verdict, the plots and the table. */
  protected readonly count = computed(() => this.analysis().plots.length + 2);
  /** π's digits on each side of the place. */
  protected readonly digits = computed(() => {
    const place = this.place();
    return {
      before: PI_DECIMALS.slice(Math.max(0, place - CONTEXT), place),
      after: PI_DECIMALS.slice(place, place + CONTEXT),
    };
  });
  /** The usual break spots: the places where a group ends. */
  private readonly breaks = computed(() =>
    this.steps().groups.flatMap((group) => (group.open ? [] : [group.start + group.size])),
  );
  protected readonly previousBreak = computed(() =>
    [...this.breaks()].reverse().find((place) => place < this.place()),
  );
  protected readonly nextBreak = computed(() =>
    this.breaks().find((place) => place > this.place()),
  );

  protected go(place: number | undefined): void {
    if (place !== undefined) {
      this.place.set(Math.min(this.last(), Math.max(1, place)));
    }
  }
}
