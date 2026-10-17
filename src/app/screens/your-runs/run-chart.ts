import { Component, computed, input } from '@angular/core';
import type { Break } from '../../game/grouping/break-models/break-model';
import { areaPath, CHART_HEIGHT, chartPath, Series } from './run-charts';

/**
 * A chart of the time per digit along the places of π: pauses are peaks. It can add what the break model makes of
 * them: the baseline, the time expected without a break, red bars at the breaks, and an area at the bottom for how
 * confident the verdicts are, and other series to compare with.
 */
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
      @if (confidenceArea(); as area) {
        <path class="confidence" [attr.d]="area" />
      }
      @for (bar of breaks(); track bar.place) {
        <line
          class="break"
          [attr.x1]="bar.place - 0.5"
          [attr.x2]="bar.place - 0.5"
          y1="0"
          [attr.y2]="height"
          [attr.stroke-opacity]="0.25 + 0.75 * bar.strength"
        />
      }
      @for (guide of guidePaths(); track $index) {
        <path class="guide" [style.stroke]="guide.color" [attr.d]="guide.d" />
      }
      @for (path of otherPaths(); track $index) {
        <path class="other" [attr.d]="path" />
      }
      @if (baselinePath(); as path) {
        <path class="baseline" [attr.d]="path" />
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

    .line,
    .baseline {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }

    .baseline {
      stroke-width: 1.25;
      stroke-opacity: 0.7;
    }

    .guide {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.25;
      stroke-dasharray: 4 3;
      vector-effect: non-scaling-stroke;
    }

    .other {
      fill: none;
      stroke: currentColor;
      stroke-width: 1;
      stroke-opacity: 0.4;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }

    .break {
      stroke: var(--chart-break);
      stroke-width: 2.5;
      vector-effect: non-scaling-stroke;
    }

    .confidence {
      fill: currentColor;
      fill-opacity: 0.2;
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
  /** The time expected at each place without a break, in milliseconds. */
  readonly baseline = input<Series>([]);
  readonly breaks = input<readonly Break[]>([]);
  /** How confident the verdict at each place is, from 0 to 1. */
  readonly confidence = input<Series>([]);
  /** Other series to compare the values with, drawn thinner and fainter, such as the times of other runs. */
  readonly others = input<readonly Series[]>([]);
  /** The settings shown on the chart, as dashed lines of times, each in its color. */
  readonly guides = input<readonly { readonly series: Series; readonly color: string }[]>([]);

  protected readonly height = CHART_HEIGHT;
  /** From place 1 at x = 0 to the last place. */
  protected readonly width = computed(() => Math.max(this.places() - 1, 1));
  protected readonly viewBox = computed(
    () => `0 0 ${String(this.width())} ${String(CHART_HEIGHT)}`,
  );
  protected readonly path = computed(() => chartPath(this.values(), this.top()));
  protected readonly baselinePath = computed(() => chartPath(this.baseline(), this.top()));
  protected readonly guidePaths = computed(() =>
    this.guides().map(({ series, color }) => ({ d: chartPath(series, this.top()), color })),
  );
  protected readonly otherPaths = computed(() =>
    this.others().map((series) => chartPath(series, this.top())),
  );
  protected readonly confidenceArea = computed(() => areaPath(this.confidence()));
  /** A line at each whole second, below the top. */
  protected readonly gridlines = computed(() =>
    Array.from(
      { length: this.top() / 1000 - 1 },
      (_, i) => CHART_HEIGHT * (1 - ((i + 1) * 1000) / this.top()),
    ),
  );
}
