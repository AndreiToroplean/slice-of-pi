import { Component, computed, input, output } from '@angular/core';
import type { Break } from '../../game/grouping/break-models/break-model';
import { areaPath, CHART_HEIGHT, chartPath, Series } from './run-charts';

/**
 * A chart of the time per digit along the places of π: pauses are peaks. It can add what the break model makes of
 * them: the baseline, the time expected without a break, red bars at the breaks, and an area at the bottom for how
 * confident the verdicts are, and other series to compare with. It can mark a place, and tells which is tapped.
 */
@Component({
  selector: 'app-run-chart',
  template: `
    <svg
      [attr.viewBox]="viewBox()"
      preserveAspectRatio="none"
      role="img"
      [attr.aria-label]="label()"
      [class.zoomed]="window() !== undefined"
      (pointerup)="pickAt($event)"
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
      @for (path of otherPaths(); track $index) {
        <path class="other" [attr.d]="path" />
      }
      @if (baselinePath(); as path) {
        <path class="baseline" [attr.d]="path" />
      }
      <path class="line" [attr.d]="path()" />
      @if (marker(); as place) {
        <line
          class="marker"
          [attr.x1]="place - 0.5"
          [attr.x2]="place - 0.5"
          y1="0"
          [attr.y2]="height"
        />
      }
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

    /* Zoomed in, the places out of the window on either side aren't drawn. */
    svg.zoomed {
      overflow: hidden;
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

    /* The place picked, between two digits, as on the plots of the break model. */
    .marker {
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-opacity: 0.8;
      stroke-dasharray: 2 2;
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
  /** The time expected at each place without a break, in milliseconds. */
  readonly baseline = input<Series>([]);
  readonly breaks = input<readonly Break[]>([]);
  /** How confident the verdict at each place is, from 0 to 1. */
  readonly confidence = input<Series>([]);
  /** Other series to compare the values with, drawn thinner and fainter, such as the times of other runs. */
  readonly others = input<readonly Series[]>([]);
  /** The place to mark, between the digit at this index and the one before: none if undefined. */
  readonly marker = input<number>();
  /** The window of the places shown, zoomed in, by index: all of them if undefined. */
  readonly window = input<{ readonly min: number; readonly max: number }>();
  /** The place tapped: the index of the digit after it. */
  readonly picked = output<number>();

  protected readonly height = CHART_HEIGHT;
  /** From place 1 at x = 0 to the last place. */
  protected readonly width = computed(() => Math.max(this.places() - 1, 1));
  /** The places shown: the window zoomed into, or all of them. */
  private readonly shown = computed(() => this.window() ?? { min: 0, max: this.width() });
  protected readonly viewBox = computed(() => {
    const { min, max } = this.shown();
    return `${String(min)} 0 ${String(max - min)} ${String(CHART_HEIGHT)}`;
  });
  protected readonly path = computed(() => chartPath(this.values(), this.top()));
  protected readonly baselinePath = computed(() => chartPath(this.baseline(), this.top()));
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

  /** Tells which place was tapped: the boundary nearest to where. */
  protected pickAt(event: MouseEvent): void {
    const box = (event.currentTarget as Element).getBoundingClientRect();
    if (box.width > 0) {
      const { min, max } = this.shown();
      this.picked.emit(
        Math.round(min + ((event.clientX - box.left) / box.width) * (max - min) + 0.5),
      );
    }
  }
}
