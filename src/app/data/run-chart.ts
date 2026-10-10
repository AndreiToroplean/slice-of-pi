import { Component, computed, input } from '@angular/core';
import { CHART_HEIGHT, chartPath, Series } from './run-charts';

/** A chart of the time per digit along the places of π: pauses are peaks. */
@Component({
  selector: 'app-run-chart',
  template: `
    <svg
      [attr.viewBox]="viewBox()"
      preserveAspectRatio="none"
      role="img"
      [attr.aria-label]="label()"
    >
      @for (y of gridlines(); track y) {
        <line class="gridline" x1="0" [attr.x2]="width()" [attr.y1]="y" [attr.y2]="y" />
      }
      <path class="line" [attr.d]="path()" />
    </svg>
  `,
  styles: `
    :host {
      display: block;
      height: 4rem;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .gridline {
      stroke: currentColor;
      stroke-opacity: 0.3;
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }

    .line {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }
  `,
})
export class RunChart {
  /** The time per digit at each place, in milliseconds. */
  readonly values = input.required<Series>();
  /** How many places the chart spans: the same for every chart, so a shorter run ends earlier. */
  readonly places = input.required<number>();
  /** The time at the top of the chart, in whole seconds' worth of milliseconds. */
  readonly top = input.required<number>();
  readonly label = input.required<string>();

  /** From place 1 at x = 0 to the last place. */
  protected readonly width = computed(() => Math.max(this.places() - 1, 1));
  protected readonly viewBox = computed(
    () => `0 0 ${String(this.width())} ${String(CHART_HEIGHT)}`,
  );
  protected readonly path = computed(() => chartPath(this.values(), this.top()));
  /** A line at each whole second, below the top. */
  protected readonly gridlines = computed(() =>
    Array.from(
      { length: this.top() / 1000 - 1 },
      (_, i) => CHART_HEIGHT * (1 - ((i + 1) * 1000) / this.top()),
    ),
  );
}
