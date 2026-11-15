import { Component, computed, inject } from '@angular/core';
import { RunStore } from '../../player-data/run-store';
import { Page } from '../../ui/page';
import { NextGoal } from './next-goal';
import { Podium, PodiumPlace } from './podium';
import { podium, recordsOf } from './records';

/**
 * The player's leaderboards, opened from the main menu: their best runs, worked out from their touch logs, so that
 * they rank every run ever played. The farthest places their perfect runs reached, on a podium, and how far the best is
 * from the next goal.
 */
@Component({
  selector: 'app-leaderboards',
  imports: [NextGoal, Page, Podium],
  template: `
    <app-page heading="Leaderboards">
      <section class="board" aria-labelledby="perfect-caption">
        <p id="perfect-caption" class="caption">Farthest without a mistake</p>
        <app-podium [places]="perfect()" />
        <app-next-goal [value]="best()" />
      </section>
    </app-page>
  `,
  styleUrl: './leaderboards.css',
})
export class Leaderboards {
  private readonly logs = inject(RunStore).logs;
  private readonly records = computed(() => recordsOf(this.logs()));
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
