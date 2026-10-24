import { Component, computed, input } from '@angular/core';
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

/** A plot of one step of the break model (`model-views.ts`), drawn as a chart like the charts of the times. */
@Component({
  selector: 'app-plot-chart',
  template: `
    <svg
      [attr.viewBox]="viewBox"
      preserveAspectRatio="none"
      role="img"
      [attr.aria-label]="plot().title + ': ' + plot().caption"
    >
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
            [style.stroke]="mark.color"
            [attr.d]="mark.d"
          />
        }
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

    rect {
      fill: currentColor;
      fill-opacity: 0.12;
    }

    rect.run {
      fill-opacity: 0.25;
    }
  `,
})
export class PlotChart {
  readonly plot = input.required<Plot>();

  protected readonly viewBox = `0 0 ${String(WIDTH)} ${String(HEIGHT)}`;
  protected readonly marks = computed(() => {
    const plot = this.plot();
    const x = (value: number): number =>
      (WIDTH * (value - plot.x.min)) / (plot.x.max - plot.x.min || 1);
    const y = (value: number): number =>
      HEIGHT *
      (1 -
        (Math.min(plot.y.max, Math.max(plot.y.min, value)) - plot.y.min) /
          (plot.y.max - plot.y.min || 1));
    return plot.layers.flatMap((layer) => marksOf(layer, x, y));
  });
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
    case 'bars':
      return layer.bars.map((bar) => {
        const top = y(bar.height);
        return {
          shape: 'rect',
          x: x(bar.from),
          y: top,
          width: Math.max(0, x(bar.to) - x(bar.from) - 1),
          height: HEIGHT - top,
          role: layer.role,
        };
      });
  }
}

function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}
