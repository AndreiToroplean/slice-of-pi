import { Component, computed, inject, signal } from '@angular/core';
import { RunStore } from '../../player-data/run-store';
import { Page } from '../../ui/page';
import { plural } from '../../ui/plural';
import { Segment, Segmented } from '../../ui/segmented';
import { TabPanel, TabPanels } from '../../ui/tab-panels';
import { Fastest } from './fastest';
import { NextGoal } from './next-goal';
import { Podium, PodiumPlace } from './podium';
import { podium, recordsOf } from './records';

/** The player's leaderboards, one per tab. */
type Board = 'perfect' | 'fastest' | 'mastery';

const BOARDS: readonly Segment<Board>[] = [
  { value: 'perfect', label: 'Perfect Run' },
  { value: 'fastest', label: 'Fastest' },
  { value: 'mastery', label: 'Mastery' },
];

/**
 * The player's leaderboards, opened from the main menu, one per tab: their best runs, worked out from their touch
 * logs, so that they rank every run ever played, swiping from one to the next. The farthest places their perfect runs reached, on a podium, with how
 * far the best is from the next goal; their fastest perfect runs to each split place; and the runs with the most
 * mastery, mistakes counted, on a podium too.
 */
@Component({
  selector: 'app-leaderboards',
  imports: [Fastest, NextGoal, Page, Podium, Segmented, TabPanel, TabPanels],
  template: `
    <app-page heading="Leaderboards" icon="leaderboards">
      <app-segmented
        label="Leaderboards"
        panels="board"
        [segments]="BOARDS"
        [follows]="boards"
        [(value)]="board"
      />
      <app-tab-panels #boards panels="board" [fills]="true" [(value)]="board">
        <section class="board" appTabPanel="perfect">
          <p class="caption">Farthest without a mistake</p>
          <app-podium [places]="perfect()" />
          <app-next-goal [value]="best()" />
        </section>
        <section class="board" appTabPanel="fastest">
          <p class="caption">Fastest without a mistake, to</p>
          <app-fastest [records]="records()" />
        </section>
        <section class="board" appTabPanel="mastery">
          <p class="caption">Digits right, mistakes counted</p>
          <app-podium [places]="mastery()" />
          <app-next-goal [value]="mostMastery()" />
        </section>
      </app-tab-panels>
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
  /** The runs with the most mastery, in whole digits, never rounded up. */
  private readonly masteryRuns = computed(() =>
    podium(this.records(), (record) => Math.floor(record.mastery.value) || undefined),
  );
  protected readonly mastery = computed((): PodiumPlace[] => {
    const byId = new Map(this.records().map((record) => [record.id, record.mastery]));
    return this.masteryRuns().map(({ id, value, startedAt }) => {
      const { reached = 0, mistakes = 0 } = byId.get(id) ?? {};
      return {
        value: String(value),
        note: `reached ${String(reached)}, ${plural(mistakes, 'mistake')}`,
        startedAt,
      };
    });
  });
  /** The most mastery a run has, 0 before any. */
  protected readonly mostMastery = computed(() => this.masteryRuns()[0]?.value ?? 0);
}
