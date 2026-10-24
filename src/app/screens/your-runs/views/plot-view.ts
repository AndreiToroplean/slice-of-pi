import { Component, input, output } from '@angular/core';
import type { Plot } from './plot';
import { PlotChart } from './plot-chart';
import { PlotLegend } from './plot-legend';

/**
 * One step of the break model as a carousel shows it: its title and where it comes among the steps, its plot, the ends
 * of its x-axis, the key to its marks, and what it shows.
 */
@Component({
  selector: 'app-plot-view',
  imports: [PlotChart, PlotLegend],
  template: `
    <div class="heading">
      <h3>{{ plot().title }}</h3>
      <span class="step">{{ step() }}</span>
    </div>
    <app-plot-chart [plot]="plot()" [marker]="marker()" (picked)="picked.emit($event)" />
    <p class="axis" aria-hidden="true">
      <span>{{ plot().x.labels[0] }}</span
      ><span>{{ plot().x.labels[1] }}</span>
    </p>
    @if (plot().legend; as keys) {
      <app-plot-legend [keys]="keys" />
    }
    <p class="caption">{{ plot().caption }}</p>
  `,
  styles: `
    :host {
      display: grid;
      align-content: start;
      gap: 0.375rem;
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

    .axis {
      display: flex;
      justify-content: space-between;
      font-size: 0.875rem;
      opacity: 0.85;
    }
  `,
})
export class PlotView {
  readonly plot = input.required<Plot>();
  /** Where it comes among the steps, such as "3/15". */
  readonly step = input.required<string>();
  /** Where to mark the plot across, in its x units: nowhere if undefined. */
  readonly marker = input<number>();
  /** Where the plot was tapped, in its x units. */
  readonly picked = output<number>();
}
