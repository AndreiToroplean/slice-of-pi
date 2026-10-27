import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { Component, input, output } from '@angular/core';
import type { Break } from '../../game/grouping/break-models/break-model';
import { LongPress } from '../../ui/long-press';
import { MoreButton } from '../../ui/more-button';
import { RunChart } from './run-chart';
import type { Series } from './run-charts';
import type { Range } from './views/plot';

/** What a run's card shows. */
export interface RunCardChart {
  readonly id: string;
  readonly title: string;
  /** Whether the game checked its digits: unchecked runs may hold mistakes. */
  readonly checked: boolean;
  /** Whether it comes after the line the game plays from, left out of the groups. */
  readonly later: boolean;
  /** How many digits it has, in how long, and in how many groups. */
  readonly meta: string;
  readonly times: Series;
  readonly baseline: Series;
  readonly breaks: readonly Break[];
}

/**
 * A run's card: its date, how many digits it has, in how long and in how many groups, and its chart. A ⋮ button in its
 * corner opens its context menu, as a long press on it does. Selectable, a tap on it, or Enter or Space, selects it or not; reorderable, a handle on its
 * left drags it to another place, as the `cdkDrag` on it has it, or moves it up or down with the arrow keys.
 */
@Component({
  selector: 'app-run-card',
  imports: [CdkDragHandle, LongPress, MoreButton, RunChart],
  host: {
    class: 'panel',
    '[class.unchecked]': '!chart().checked',
    '[class.later]': 'chart().later',
    '[class.selected]': 'selected()',
  },
  template: `
    @if (reorderable()) {
      <button
        type="button"
        class="handle"
        cdkDragHandle
        [attr.data-run]="chart().id"
        [title]="'Move the run of ' + chart().title + ', with the arrow keys'"
        (keydown)="step($event)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="6" r="1.75" />
          <circle cx="15" cy="6" r="1.75" />
          <circle cx="9" cy="12" r="1.75" />
          <circle cx="15" cy="12" r="1.75" />
          <circle cx="9" cy="18" r="1.75" />
          <circle cx="15" cy="18" r="1.75" />
        </svg>
      </button>
    }
    <article
      [attr.role]="selectable() ? 'button' : null"
      [attr.aria-pressed]="selectable() ? selected() : null"
      tabindex="0"
      (appLongPress)="pressed.emit($event)"
      (appTap)="select()"
      (keydown.enter)="select()"
      (keydown.space)="select($event)"
    >
      <h3>
        {{ chart().title }}
        @if (!chart().checked) {
          <span class="badge">Unchecked</span>
        }
      </h3>
      <p class="meta">{{ chart().meta }}</p>
      <app-run-chart
        [values]="chart().times"
        [baseline]="chart().baseline"
        [breaks]="chart().breaks"
        [places]="places()"
        [top]="top()"
        [window]="window()"
        [label]="'Time per digit, ' + chart().title"
      />
    </article>
    <button
      class="more"
      [appMore]="menu()"
      [title]="'More for the run of ' + chart().title"
      (click)="opening.emit()"
    ></button>
  `,
  styleUrl: './run-card.css',
})
export class RunCard {
  readonly chart = input.required<RunCardChart>();
  /** The places its chart spans, and the top of its scale, shared with the other charts. */
  readonly places = input.required<number>();
  readonly top = input.required<number>();
  /** The window of the places shown: all of them if undefined. */
  readonly window = input<Range>();
  /** Whether a tap selects it or not, and whether it is. */
  readonly selectable = input(false);
  readonly selected = input(false);
  /** Whether it has a handle to move it to another place. */
  readonly reorderable = input(false);
  /** The id of its context menu, which its ⋮ button opens. */
  readonly menu = input.required<string>();
  /** Its context menu opening from its ⋮ button. */
  readonly opening = output();
  /** Where it was long pressed, for its context menu. */
  readonly pressed = output<{ readonly x: number; readonly y: number }>();
  /** Tapped, while selectable. */
  readonly toggled = output();
  /** Moved up (-1) or down (1) a place with the arrow keys on its handle. */
  readonly moved = output<number>();

  protected select(event?: Event): void {
    if (!this.selectable()) {
      return;
    }
    event?.preventDefault();
    this.toggled.emit();
  }

  protected step(event: KeyboardEvent): void {
    const step = ARROW_STEPS[event.key];
    if (step !== undefined) {
      event.preventDefault();
      this.moved.emit(step);
    }
  }
}

/** How far each arrow key moves a run. */
const ARROW_STEPS: Partial<Record<string, number>> = { ArrowUp: -1, ArrowDown: 1 };
