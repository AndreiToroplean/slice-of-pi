import { Component, input } from '@angular/core';
import type { Key } from './plot';

/** The key to the marks of a plot: a swatch drawn like each kind of mark, and what it stands for. */
@Component({
  selector: 'app-plot-legend',
  template: `
    <ul>
      @for (key of keys(); track $index) {
        <li>
          <i
            aria-hidden="true"
            [class]="key.mark + ' ' + key.role"
            [style.--swatch]="key.color ?? null"
          ></i
          >{{ key.label }}
        </li>
      }
    </ul>
  `,
  styles: `
    ul {
      display: flex;
      flex-wrap: wrap;
      gap: 0.125rem 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 0.75rem;
      line-height: 1.3;
    }

    /* Like the marks on the plots: lines and dots in the ink, faint or red as theirs are. */
    i {
      --swatch: currentColor;
      display: inline-block;
      width: 1rem;
      margin-right: 0.3125rem;
      vertical-align: middle;
      color: var(--swatch);
    }

    i.break {
      --swatch: var(--chart-break);
    }

    i.line {
      border-top: 2px solid;
    }

    i.line.run {
      border-top-width: 1.25px;
      opacity: 0.6;
    }

    i.line.faint {
      border-top-width: 1px;
      opacity: 0.45;
    }

    i.line.guide {
      border-top: 1.5px dashed;
    }

    i.dots {
      width: 0.375rem;
      height: 0.375rem;
      margin: 0 0.625rem 0 0.3125rem;
      border-radius: 50%;
      background: currentColor;
    }

    i.dots.faint {
      opacity: 0.45;
    }

    i.dots.run {
      opacity: 0.75;
    }

    i.area,
    i.bars {
      height: 0.625rem;
      border-radius: 0.125rem;
      background: currentColor;
      opacity: 0.25;
    }

    i.bars.aggregate {
      opacity: 0.6;
    }

    i.bars.break,
    i.area.break {
      opacity: 0.6;
    }
  `,
})
export class PlotLegend {
  readonly keys = input.required<readonly Key[]>();
}
