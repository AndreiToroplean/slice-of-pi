import { Component, computed, input } from '@angular/core';
import { PALETTE } from '../../game/layers/place-colors';
import { podium, RunRecord, splitPlace } from './records';

/** A split time, in milliseconds, as the leaderboards say it: in seconds to a tenth, with minutes past one. */
export function splitTime(milliseconds: number): string {
  const tenths = Math.round(milliseconds / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = (tenths % 600) / 10;
  return minutes === 0
    ? `${seconds.toFixed(1)} s`
    : `${String(minutes)}:${seconds.toFixed(1).padStart(4, '0')}`;
}

/** A split place on the board: its place, in its color, and its best times, the best first. */
interface SplitRow {
  readonly place: number;
  readonly color: string;
  readonly best: string;
  readonly then: string;
}

/**
 * The fastest perfect runs to each split place reached: a row for each, the best time big, the next two after it,
 * then the next split place to reach, locked.
 */
@Component({
  selector: 'app-fastest',
  template: `
    <ol>
      @for (row of rows(); track row.place) {
        <li>
          <span class="tile" [style.background]="row.color">{{ row.place }}</span>
          <span class="best">{{ row.best }}</span>
          <span class="then">{{ row.then }}</span>
        </li>
      }
      <li class="locked">
        <span class="tile">{{ next() }}</span>
        <span class="best">Not reached yet</span>
      </li>
    </ol>
  `,
  styles: `
    :host {
      display: block;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      /* Room for the rows' edges and focus rings as they scroll. */
      margin-inline: -0.25rem;
      padding: 0.25rem;
    }

    ol {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 0.625rem;
    }

    li {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      padding: 0.625rem 0.875rem;
      border-radius: 1.125rem;
      background: var(--frost);
      box-shadow: 0 0.25rem 0 var(--frost-edge);
    }

    .tile {
      min-width: 3.625rem;
      padding: 0.375rem 0;
      border-radius: 0.75rem;
      text-align: center;
      color: var(--on-palette);
      font-family: var(--font-digits);
      font-size: 1.25rem;
      font-weight: 600;
      text-shadow: var(--text-shadow);
    }

    .best {
      flex: 1;
      font-family: var(--font-digits);
      font-size: 1.5rem;
      font-weight: 600;
      text-shadow: var(--text-shadow);
    }

    .then {
      font-size: 0.75rem;
      text-shadow: var(--text-shadow);
    }

    /* The next one to reach, standing empty. */
    .locked {
      background: none;
      box-shadow: none;
      outline: 0.125rem dashed rgb(255 255 255 / 35%);
      outline-offset: -0.125rem;
    }

    .locked .tile {
      background: rgb(255 255 255 / 30%);
    }

    .locked .best {
      font-size: 1rem;
    }
  `,
})
export class Fastest {
  readonly records = input.required<readonly RunRecord[]>();
  /** How many split places perfect runs reached. */
  private readonly reached = computed(() =>
    Math.max(0, ...this.records().map((record) => record.splits.length)),
  );
  protected readonly rows = computed((): SplitRow[] => {
    const count = this.reached();
    return Array.from({ length: count }, (_, i) => {
      const place = splitPlace(i);
      const [best, ...then] = podium(this.records(), (record) => record.splits[i], {
        lowest: true,
      }).map(({ value }) => splitTime(value));
      return {
        place,
        // The palette's colors in order, starting over past its last, as a key steps through them.
        color: PALETTE[i % PALETTE.length] ?? '',
        best: best ?? '',
        then: then.join(' · '),
      };
    });
  });
  protected readonly next = computed(() => splitPlace(this.reached()));
}
