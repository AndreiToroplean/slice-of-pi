import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { PODIUM } from './records';

/** A record on a podium: what it says, big, a note under it, if any, and when its run started. */
export interface PodiumPlace {
  readonly value: string;
  readonly note?: string;
  readonly startedAt: number;
}

/**
 * The best records at a feat on a podium, as an ordered list, the best first: the first in the middle, on the highest
 * step, in gold, the second on its left, in silver, the third on its right, in bronze. Its steps stand empty until runs
 * fill them. They're as tall as it lets them be, so it takes the height it's given.
 */
@Component({
  selector: 'app-podium',
  imports: [DatePipe],
  template: `
    <ol>
      @for (place of places(); track $index) {
        <li [class]="'rank-' + ($index + 1)">
          <span class="medal" aria-hidden="true">{{ $index + 1 }}</span>
          <span class="value">{{ place.value }}</span>
          <span class="note">{{ place.note }}</span>
          <span class="step">{{ place.startedAt | date: 'd MMM' }}</span>
        </li>
      }
      @for (rank of empty(); track rank) {
        <li [class]="'rank-' + rank + ' empty'" aria-hidden="true">
          <span class="medal">{{ rank }}</span>
          <span class="step"></span>
        </li>
      }
    </ol>
  `,
  styleUrl: './podium.css',
})
export class Podium {
  /** The records, the best first, as many as fit on it. */
  readonly places = input.required<readonly PodiumPlace[]>();
  /** The ranks no record fills. */
  protected readonly empty = computed(() =>
    Array.from({ length: PODIUM - this.places().length }, (_, i) => this.places().length + i + 1),
  );
}
