import { Component, computed, input, output } from '@angular/core';
import { Layer, Plot, Point } from './plot';

/** The size of a plot, in the units of its `viewBox`: it's stretched to its box, its lines keeping their width. */
const WIDTH = 1000;
const HEIGHT = 100;

/** A drawn mark: its SVG element, and where it goes. */
type Mark =
  | {
      readonly shape: 'path';
      readonly d: string;
      readonly role: string;
      readonly dots: boolean;
      readonly area?: boolean;
      readonly color?: string | undefined;
    }
  | {
      readonly shape: 'rect';
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly role: string;
    };

/**
 * A plot of one step of the break model (`plot.ts`), drawn as a chart like the charts of the times, with the values
 * marked on its y-axis, and a line across it where it's marked, such as at the place picked. It tells where it's tapped.
 */
@Component({
  selector: 'app-plot-chart',
  template: `
    <svg
      [attr.viewBox]="viewBox"
      preserveAspectRatio="none"
      role="img"
      [attr.aria-label]="plot().title + ': ' + plot().caption"
      (pointerup)="pickAt($event)"
    >
      @for (tick of ticks(); track $index) {
        <path class="tick" [attr.d]="tick.d" />
      }
      @for (mark of marks(); track $index) {
        @if (mark.shape === 'rect') {
          <rect
            [class]="mark.role"
            [attr.x]="mark.x"
            [attr.y]="mark.y"
            [attr.width]="mark.width"
            [attr.height]="mark.height"
          />
        } @else {
          <path
            [class]="mark.role"
            [class.dots]="mark.dots"
            [class.area]="mark.area"
            [style.stroke]="mark.color"
            [attr.d]="mark.d"
          />
        }
      }
      @if (markerPath(); as d) {
        <path class="marker" [attr.d]="d" />
      }
    </svg>
    @for (tick of ticks(); track $index) {
      <span class="label" aria-hidden="true" [style.top.%]="tick.top">{{ tick.label }}</span>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      height: 4rem;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    path {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }

    path.dots {
      stroke-width: 3.5;
    }

    path.run {
      stroke-width: 1.25;
      stroke-opacity: 0.6;
    }

    path.dots.run {
      stroke-width: 3;
    }

    path.faint {
      stroke-width: 1;
      stroke-opacity: 0.35;
    }

    path.dots.faint {
      stroke-width: 2.5;
    }

    path.break {
      stroke: var(--chart-break);
    }

    path.guide {
      stroke-width: 1.25;
      stroke-dasharray: 4 3;
    }

    path.area {
      fill: currentColor;
      fill-opacity: 0.14;
      stroke: none;
    }

    path.area.break {
      fill: var(--chart-break);
    }

    path.tick {
      stroke-width: 1;
      stroke-opacity: 0.15;
    }

    /* The place picked, across every plot along the places. */
    path.marker {
      stroke-width: 1.5;
      stroke-opacity: 0.8;
      stroke-dasharray: 2 2;
    }

    rect {
      fill: currentColor;
      fill-opacity: 0.12;
    }

    rect.run {
      fill-opacity: 0.25;
    }

    rect.aggregate {
      fill-opacity: 0.55;
    }

    rect.break {
      fill: var(--chart-break);
      fill-opacity: 0.7;
    }

    /* The values marked on the y-axis, at the left, past a carousel's arrow, readable over the marks. */
    .label {
      position: absolute;
      left: 1.125rem;
      translate: 0 -50%;
      padding: 0 0.125rem;
      border-radius: 0.25rem;
      background: rgb(255 255 255 / 75%);
      font-size: 0.625rem;
      line-height: 1.2;
      font-variant-numeric: tabular-nums;
      pointer-events: none;
    }
  `,
})
export class PlotChart {
  readonly plot = input.required<Plot>();
  /** Where to mark the plot across, in its x units, such as the place picked: nowhere if undefined. */
  readonly marker = input<number>();
  /** Where the plot was tapped, in its x units. */
  readonly picked = output<number>();

  protected readonly viewBox = `0 0 ${String(WIDTH)} ${String(HEIGHT)}`;
  private readonly scales = computed(() => {
    const plot = this.plot();
    return {
      x: (value: number): number => (WIDTH * (value - plot.x.min)) / (plot.x.max - plot.x.min || 1),
      y: (value: number): number =>
        HEIGHT *
        (1 -
          (Math.min(plot.y.max, Math.max(plot.y.min, value)) - plot.y.min) /
            (plot.y.max - plot.y.min || 1)),
    };
  });
  protected readonly marks = computed(() => {
    const { x, y } = this.scales();
    return this.plot().layers.flatMap((layer) => marksOf(layer, x, y));
  });
  /** The values marked on the y-axis within its range: a line across, and how far down its label goes. */
  protected readonly ticks = computed(() => {
    const { y } = this.scales();
    const { min, max, ticks = [] } = this.plot().y;
    return ticks
      .filter(({ value }) => value >= min && value <= max)
      .map(({ value, label }) => ({
        label,
        d: `M0 ${round(y(value))}H${String(WIDTH)}`,
        top: (100 * y(value)) / HEIGHT,
      }));
  });
  protected readonly markerPath = computed(() => {
    const marker = this.marker();
    const { min, max } = this.plot().x;
    return marker === undefined || marker < min || marker > max
      ? undefined
      : `M${round(this.scales().x(marker))} 0V${String(HEIGHT)}`;
  });

  /** Tells where along x the plot was tapped. */
  protected pickAt(event: MouseEvent): void {
    const box = (event.currentTarget as Element).getBoundingClientRect();
    if (box.width > 0) {
      const { min, max } = this.plot().x;
      this.picked.emit(min + ((max - min) * (event.clientX - box.left)) / box.width);
    }
  }
}

function marksOf(layer: Layer, x: (value: number) => number, y: (value: number) => number): Mark[] {
  const at = ([px, py]: Point): string => `${round(x(px))} ${round(y(py))}`;
  switch (layer.kind) {
    case 'line': {
      let d = '';
      let drawing = false;
      for (const point of layer.points) {
        if (point === undefined) {
          drawing = false;
          continue;
        }
        d += drawing ? `L${at(point)}` : `M${at(point)}h0`;
        drawing = true;
      }
      return [{ shape: 'path', d, role: layer.role, dots: false, color: layer.color }];
    }
    case 'dots':
      return [
        {
          shape: 'path',
          d: layer.points.map((point) => `M${at(point)}h0`).join(''),
          role: layer.role,
          dots: true,
        },
      ];
    case 'hline':
      return [
        {
          shape: 'path',
          d: `M0 ${round(y(layer.y))}H${String(WIDTH)}`,
          role: layer.role,
          dots: false,
          color: layer.color,
        },
      ];
    case 'vline':
      return [
        {
          shape: 'path',
          d: `M${round(x(layer.x))} 0V${String(HEIGHT)}`,
          role: layer.role,
          dots: false,
          color: layer.color,
        },
      ];
    case 'band': {
      const top = y(Math.max(layer.from, layer.to));
      return [
        {
          shape: 'rect',
          x: 0,
          y: top,
          width: WIDTH,
          height: y(Math.min(layer.from, layer.to)) - top,
          role: layer.role,
        },
      ];
    }
    case 'area':
      return [
        {
          shape: 'path',
          d: areaOf(layer.upper, layer.lower, at),
          role: layer.role,
          dots: false,
          area: true,
        },
      ];
    case 'bars':
      return layer.bars.map((bar) => {
        const top = y(bar.base === undefined ? bar.height : Math.max(bar.height, bar.base));
        const bottom = bar.base === undefined ? HEIGHT : y(Math.min(bar.height, bar.base));
        return {
          shape: 'rect',
          x: x(bar.from),
          y: top,
          width: Math.max(0, x(bar.to) - x(bar.from) - 1),
          height: Math.max(0, bottom - top),
          role: layer.role,
        };
      });
  }
}

/** The area between two lines, as one closed shape for each stretch where both have a point. */
function areaOf(
  upper: readonly (Point | undefined)[],
  lower: readonly (Point | undefined)[],
  at: (point: Point) => string,
): string {
  let d = '';
  let stretch: (readonly [Point, Point])[] = [];
  const close = (): void => {
    if (stretch.length > 0) {
      const tops = stretch.map(([top]) => at(top));
      const bottoms = stretch.map(([, bottom]) => at(bottom)).reverse();
      d += `M${[...tops, ...bottoms].join('L')}Z`;
    }
    stretch = [];
  };
  upper.forEach((top, i) => {
    const bottom = lower[i];
    if (top === undefined || bottom === undefined) {
      close();
    } else {
      stretch.push([top, bottom]);
    }
  });
  close();
  return d;
}

function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}
