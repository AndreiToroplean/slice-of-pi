import { Component, computed, inject, signal } from '@angular/core';
import { RunStore } from '../../player-data/run-store';
import { Page } from '../../ui/page';
import { Segment, Segmented } from '../../ui/segmented';
import { Fastest } from './fastest';
import { NextGoal } from './next-goal';
import { Podium, PodiumPlace } from './podium';
import { podium, recordsOf } from './records';

/** The player's leaderboards, one per tab. */
type Board = 'perfect' | 'fastest';

const BOARDS: readonly Segment<Board>[] = [
  { value: 'perfect', label: 'Perfect Run' },
  { value: 'fastest', label: 'Fastest' },
];

/**
 * The player's leaderboards, opened from the main menu, one per tab: their best runs, worked out from their touch
 * logs, so that they rank every run ever played. The farthest places their perfect runs reached, on a podium, with how
 * far the best is from the next goal; and their fastest perfect runs to each split place.
 */
@Component({
  selector: 'app-leaderboards',
  imports: [Fastest, NextGoal, Page, Podium, Segmented],
  template: `
    <app-page heading="Leaderboards">
      <app-segmented label="Leaderboards" panels="board" [segments]="BOARDS" [(value)]="board" />
      @switch (board()) {
        @case ('perfect') {
          <section
            class="board"
            role="tabpanel"
            id="board-perfect"
            aria-labelledby="board-tab-perfect"
          >
            <p class="caption">Farthest without a mistake</p>
            <app-podium [places]="perfect()" />
            <app-next-goal [value]="best()" />
          </section>
        }
        @case ('fastest') {
          <section
            class="board"
            role="tabpanel"
            id="board-fastest"
            aria-labelledby="board-tab-fastest"
          >
            <p class="caption">Fastest without a mistake, to</p>
            <app-fastest [records]="records()" />
          </section>
        }
      }
    </app-page>
  `,
  styleUrl: './leaderboards.css',
})
export class Leaderboards {
  protected readonly BOARDS = BOARDS;
  protected readonly board = signal<Board>('perfect');
  private readonly logs = inject(RunStore).logs;
  protected readonly records = computed(() => recordsOf(this.logs()));
  private readonly perfectRuns = computed(() =>
    podium(this.records(), (record) => record.perfect || undefined),
  );
  /** The farthest places perfect runs reached. */
  protected readonly perfect = computed((): PodiumPlace[] =>
    this.perfectRuns().map(({ value, startedAt }) => ({ value: String(value), startedAt })),
  );
  /** The farthest place a perfect run reached, 0 before any. */
  protected readonly best = computed(() => this.perfectRuns()[0]?.value ?? 0);
}
