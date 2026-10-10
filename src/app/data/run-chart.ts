import { Component, computed, input } from '@angular/core';
import { areaPath, CHART_HEIGHT, ChartBreak, chartPath, Series } from './run-charts';

/**
 * A chart of the time per digit along the places of π: pauses are peaks. It can add what the timing model makes of
 * them: the local pace and the time above which a digit is a pause, red bars at the breaks, and an area at the bottom
 * for how much the verdicts are trusted.
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
      @if (trustArea(); as area) {
        <path class="trust" [attr.d]="area" />
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
      @if (thresholdPath(); as path) {
        <path class="threshold" [attr.d]="path" />
      }
      @if (pacePath(); as path) {
        <path class="pace" [attr.d]="path" />
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
    .pace,
    .threshold {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }

    .pace,
    .threshold {
      stroke-width: 1.25;
      stroke-opacity: 0.7;
    }

    .threshold {
      stroke-dasharray: 4 3;
    }

    .break {
      stroke: var(--chart-break);
      stroke-width: 2.5;
      vector-effect: non-scaling-stroke;
    }

    .trust {
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
  /** The local pace at each place, in milliseconds. */
  readonly pace = input<Series>([]);
  /** The time above which a digit is a pause, at each place, in milliseconds. */
  readonly threshold = input<Series>([]);
  readonly breaks = input<readonly ChartBreak[]>([]);
  /** How much the verdict at each place is trusted, from 0 to 1. */
  readonly trust = input<Series>([]);

  protected readonly height = CHART_HEIGHT;
  /** From place 1 at x = 0 to the last place. */
  protected readonly width = computed(() => Math.max(this.places() - 1, 1));
  protected readonly viewBox = computed(
    () => `0 0 ${String(this.width())} ${String(CHART_HEIGHT)}`,
  );
  protected readonly path = computed(() => chartPath(this.values(), this.top()));
  protected readonly pacePath = computed(() => chartPath(this.pace(), this.top()));
  protected readonly thresholdPath = computed(() => chartPath(this.threshold(), this.top()));
  protected readonly trustArea = computed(() => areaPath(this.trust()));
  /** A line at each whole second, below the top. */
  protected readonly gridlines = computed(() =>
    Array.from(
      { length: this.top() / 1000 - 1 },
      (_, i) => CHART_HEIGHT * (1 - ((i + 1) * 1000) / this.top()),
    ),
  );
}
