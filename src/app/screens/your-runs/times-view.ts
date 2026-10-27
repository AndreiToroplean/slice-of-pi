import { Component, computed, input, model, output, signal } from '@angular/core';
import type { Break } from '../../game/grouping/break-models/break-model';
import { RunChart } from './run-chart';
import type { Series } from './run-charts';
import { Key, keyIdOf, Range } from './views/plot';
import { PlotLegend, toggledIn } from './views/plot-legend';
import { Zoom } from './views/zoom';

/** The chart of all the runs counted, recent ones weighing more, and what the break model makes of it. */
export interface AggregateTimes {
  readonly times: Series;
  readonly baseline: Series;
  readonly breaks: readonly Break[];
  /** How confident its verdicts are, if shown. */
  readonly confidence?: Series;
}

/** The marks of the chart of times, by the key each shows under. */
export const TIMES = {
  time: { mark: 'line', role: 'aggregate', label: 'Time per digit' },
  baseline: { mark: 'line', role: 'run', label: 'Baseline' },
  breaks: { mark: 'bars', role: 'break', label: 'Usual break' },
  confidence: { mark: 'area', role: 'faint', label: 'Confidence trend' },
  others: { mark: 'line', role: 'faint', label: 'Runs picked' },
} as const satisfies Record<string, Key>;

/**
 * The time per digit along the places, over all the runs and any others: its title, and where it comes among the steps,
 * if it's one, its chart, zoomed in and out along the places, the ends of the places shown, the key to its marks, which
 * hides or shows them, what it shows, and what else is given to it.
 */
@Component({
  selector: 'app-times-view',
  imports: [PlotLegend, RunChart, Zoom],
  template: `
    <div class="heading">
      <h3>{{ title() }}</h3>
      @if (step(); as step) {
        <span class="step">{{ step }}</span>
      }
    </div>
    <app-run-chart
      [values]="shown(TIMES.time) ? (aggregate()?.times ?? []) : []"
      [baseline]="shown(TIMES.baseline) ? (aggregate()?.baseline ?? []) : []"
      [breaks]="shown(TIMES.breaks) ? (aggregate()?.breaks ?? []) : []"
      [confidence]="shown(TIMES.confidence) ? (aggregate()?.confidence ?? []) : []"
      [others]="shown(TIMES.others) ? others() : []"
      [places]="places()"
      [top]="top()"
      [marker]="marker()"
      [window]="zoom()"
      [appZoom]="axis()"
      [(zoom)]="zoom"
      label="Time per digit over all runs, recent ones weighing more, with your usual break spots"
      (picked)="picked.emit($event)"
    />
    <p class="axis" aria-hidden="true">
      <span>{{ labels()[0] }}</span
      ><span>{{ labels()[1] }}</span>
    </p>
    <app-plot-legend [keys]="keys()" [hidden]="hidden()" (toggled)="toggle($event)" />
    @if (caption(); as caption) {
      <p class="caption">{{ caption }}</p>
    }
    <ng-content />
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
export class TimesView {
  readonly title = input.required<string>();
  /** Where it comes among the steps, such as "1/15", if it's one. */
  readonly step = input<string>();
  /** The chart of all the runs: left out if undefined. */
  readonly aggregate = input<AggregateTimes>();
  /** The times of other runs, to compare with. */
  readonly others = input<readonly Series[]>([]);
  /** The places the chart spans, and the top of its scale, shared with the charts of the runs. */
  readonly places = input.required<number>();
  readonly top = input.required<number>();
  /** The keys to the marks it shows. */
  readonly keys = input.required<readonly Key[]>();
  /** What it shows, under the key, if anything. */
  readonly caption = input<string>();
  /** The place to mark, if any. */
  readonly marker = input<number>();
  /** The window of the places shown, shared with the charts along the places: all of them if undefined. */
  readonly zoom = model<Range | undefined>(undefined);
  /** The place tapped. */
  readonly picked = output<number>();

  protected readonly TIMES = TIMES;
  /** The keys whose marks are hidden, by id, toggled on the key: only while the page is open, never saved. */
  protected readonly hidden = signal<ReadonlySet<string>>(new Set());
  /** All the places, by index. */
  protected readonly axis = computed(() => ({ min: 0, max: Math.max(this.places() - 1, 1) }));
  /** The ends of the places shown. */
  protected readonly labels = computed(() => {
    const zoom = this.zoom();
    return zoom === undefined
      ? ['Place 1', `Place ${String(this.places())}`]
      : [`Place ${String(Math.round(zoom.min) + 1)}`, `Place ${String(Math.round(zoom.max) + 1)}`];
  });

  protected shown(key: Key): boolean {
    return !this.hidden().has(keyIdOf(key));
  }

  protected toggle(id: string): void {
    this.hidden.update((hidden) => toggledIn(hidden, id));
  }
}
