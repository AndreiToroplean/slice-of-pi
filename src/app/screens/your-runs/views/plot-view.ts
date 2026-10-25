import { Component, computed, input, model, output, signal } from '@angular/core';
import { keyIdOfLayer, Plot, Range } from './plot';
import { PlotChart } from './plot-chart';
import { PlotLegend, toggledIn } from './plot-legend';
import { Zoom } from './zoom';

/**
 * One step of the break model as a carousel shows it: its title and where it comes among the steps, its plot, zoomed in
 * and out along its x-axis, the ends of the window of it shown, the key to its marks, which hides or shows them, and
 * what it shows.
 */
@Component({
  selector: 'app-plot-view',
  imports: [PlotChart, PlotLegend, Zoom],
  template: `
    <div class="heading">
      <h3>{{ plot().title }}</h3>
      <span class="step">{{ step() }}</span>
    </div>
    <app-plot-chart
      [plot]="shownPlot()"
      [marker]="marker()"
      [window]="zoom()"
      [appZoom]="plot().x"
      [(zoom)]="zoom"
      (picked)="picked.emit($event)"
    />
    <p class="axis" aria-hidden="true">
      <span>{{ labels()[0] }}</span
      ><span>{{ labels()[1] }}</span>
    </p>
    @if (plot().legend; as keys) {
      <app-plot-legend [keys]="keys" [hidden]="hidden()" (toggled)="toggle($event)" />
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
  /** The window of its x-axis shown, shared with the steps along the same axis: all of it if undefined. */
  readonly zoom = model<Range | undefined>(undefined);

  /** The keys whose marks are hidden, by id, toggled on the key: only while the page is open, never saved. */
  protected readonly hidden = signal<ReadonlySet<string>>(new Set());
  /** The plot without the marks hidden. */
  protected readonly shownPlot = computed(() => {
    const plot = this.plot();
    const hidden = this.hidden();
    return hidden.size === 0
      ? plot
      : { ...plot, layers: plot.layers.filter((layer) => !hidden.has(keyIdOfLayer(layer))) };
  });

  protected toggle(id: string): void {
    this.hidden.update((hidden) => toggledIn(hidden, id));
  }

  /** The ends of the x-axis shown, as they read. */
  protected readonly labels = computed(() => {
    const { x } = this.plot();
    const zoom = this.zoom();
    return zoom === undefined || x.label === undefined
      ? x.labels
      : ([x.label(zoom.min), x.label(zoom.max)] as const);
  });
}
