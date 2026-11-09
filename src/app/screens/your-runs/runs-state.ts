import { computed, inject, Injectable, signal } from '@angular/core';
import { Tweaks } from '../../developer-mode/tweaks';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { groupRuns, moveRun, orderRuns, Run, RunOrder } from '../../player-data/run';
import { RunRecorder } from '../../player-data/run-recorder';
import { RunStore } from '../../player-data/run-store';
import { CONFIRM } from '../../ui/confirm';
import { plural } from '../../ui/plural';
import { ShownGroup } from './group-list';
import { chartTop, digitTimes } from './run-charts';
import type { RunCardChart } from './run-card';

/**
 * The player's runs as a page of them shows them, provided by each such page: read as it opens, in the order the game
 * takes them, what the break model makes of them, the chart of each and of all of them, and deleting them. The tweaks
 * apply, as they do to the whole game: unchecked runs, which may hold mistakes, are only shown while they count in the
 * groups. Neither are runs from a checkpoint, nor Discover's.
 */
@Injectable()
export class RunsState {
  /** What the page last did, for screen readers too. */
  readonly message = signal('');

  private readonly tweaks = inject(Tweaks);
  private readonly store = inject(RunStore);
  readonly runs = this.store.runs;
  private readonly recorder = inject(RunRecorder);
  private readonly confirm = inject(CONFIRM);

  /** The runs the groups are computed from, oldest first. */
  readonly counted = computed(() =>
    groupRuns(this.runs(), this.tweaks.includeUnchecked(), this.tweaks.runOrder()),
  );
  /** The runs in the order the game takes them, and how many are above the line played from, if any. */
  readonly order = computed(() => orderRuns(this.runs(), this.tweaks.runOrder()));
  /** What the break model makes of them: the groups the game plays with. */
  readonly stats = computed(() => this.tweaks.breakModel().stats(this.counted()));
  /** The runs shown, by their chart, in the order the game takes them. */
  readonly charts = computed(() =>
    this.order().runs.flatMap((run, index): RunCardChart[] => {
      if (!this.shows(run)) {
        return [];
      }
      // Runs left out of the groups have only their times.
      const found = this.stats().runs[this.counted().indexOf(run)];
      const breaks = found?.breaks ?? [];
      return [
        {
          id: run.id,
          title: dateAndTime.format(run.startedAt),
          checked: run.checked,
          later: index >= (this.order().line ?? Infinity),
          meta:
            `${plural(run.digits.length, 'digit')} in ${seconds(run.times.at(-1) ?? 0)}` +
            (run.digits.length > 0 ? ` · ${plural(breaks.length + 1, 'group')}` : ''),
          times: digitTimes(run),
          baseline: found?.baseline ?? [],
          breaks,
        },
      ];
    }),
  );
  /** Every chart spans the places of the longest run shown. */
  readonly places = computed(() =>
    Math.max(
      1,
      ...this.runs()
        .filter((run) => this.shows(run))
        .map((run) => run.digits.length),
    ),
  );
  /** The top of every chart's scale. */
  readonly top = computed(() => chartTop(this.charts().map((chart) => chart.times)));
  /** The chart of all the runs counted, recent ones weighing more. */
  readonly aggregateChart = computed(() => {
    const stats = this.stats();
    return {
      times: stats.averageTime,
      baseline: stats.speedCurve,
      breaks: stats.usual,
      confidence: stats.confidence,
    };
  });
  /** The groups of all the runs counted. */
  readonly groups = computed((): readonly ShownGroup[] =>
    this.stats().groups.map((group) => ({
      start: group.start,
      digits: PI_DECIMALS.slice(group.start, group.start + group.size),
      trusted: group.trusted,
    })),
  );
  /** The runs shown, and the line played from among them, if any, which has no chart. */
  readonly rows = computed(() => {
    const rows = this.charts().map((chart) => ({ id: chart.id, chart }));
    const line = this.order().line;
    return line === undefined
      ? rows
      : [...rows.slice(0, line), { id: '', chart: undefined }, ...rows.slice(line)];
  });
  /** The order of the runs shown, to change. */
  readonly shownOrder = computed((): RunOrder => {
    const { runs, line } = this.order();
    const ids = runs.map((run) => run.id);
    return line === undefined ? { ids } : { ids, line };
  });
  /** Whether the runs are shown in the order they were played in. */
  readonly chronological = computed(() =>
    this.order().runs.every(
      (run, i, runs) => i === 0 || (runs[i - 1]?.startedAt ?? 0) <= run.startedAt,
    ),
  );
  /** What the runs counted are called, as a whole. */
  readonly aggregateTitle = computed(() =>
    this.order().line === undefined ? 'All runs' : 'Runs before here',
  );

  /**
   * Plays from just after the run with this id, as if only the runs up to it had been played, or from before all of
   * them if none, keeping the order shown. A tweak, it only applies in developer mode.
   */
  playFrom(id?: string): void {
    const { ids } = this.shownOrder();
    const line = id === undefined ? 0 : ids.indexOf(id) + 1;
    if (line !== 0 || id === undefined) {
      void this.tweaks.setRunOrder({ ids, line });
    }
  }

  /** Plays from after all the runs again, keeping them in the order shown. */
  undoPlayFrom(): void {
    void this.tweaks.setRunOrder({ ids: this.shownOrder().ids });
  }

  /** Moves the run or the line shown at one place among the rows to another. */
  move(from: number, to: number): void {
    if (from !== to) {
      void this.tweaks.setRunOrder(moveRun(this.shownOrder(), from, to));
    }
  }

  /** Puts the runs back in the order they were played in, the line staying where it is, under as many runs. */
  reorderChronologically(): void {
    const { runs, line } = this.order();
    const ids = [...runs].sort((a, b) => a.startedAt - b.startedAt).map((run) => run.id);
    void this.tweaks.setRunOrder(line === undefined ? undefined : { ids, line });
  }

  /** Deletes every run kept, once the player confirms. */
  async deleteAll(): Promise<void> {
    await this.recorder.saved();
    const count = this.runs().length;
    if (
      !this.confirm(
        `Delete ${count === 1 ? 'the run' : `all ${String(count)} runs`} kept on this device? Only a backup file can bring ${count === 1 ? 'it' : 'them'} back.`,
      )
    ) {
      return;
    }
    await this.store.deleteAllRuns();
    this.message.set(`Deleted ${plural(count, 'run')}.`);
  }

  /** Deletes a run, once the player confirms. */
  deleteRun(id: string): Promise<void> {
    return this.deleteRuns(
      [id],
      'Delete this run? Only a backup file can bring it back.',
      'Deleted the run.',
    );
  }

  /** Deletes the runs with these ids, once the player confirms what they're asked. */
  async deleteRuns(ids: readonly string[], question: string, done: string): Promise<void> {
    await this.recorder.saved();
    if (!this.confirm(question)) {
      return;
    }
    await this.store.deleteRuns(ids);
    this.message.set(done);
  }

  /**
   * Whether it shows a run: unchecked ones only while they're included. Runs from a checkpoint and Discover's aren't
   * charted, as the charts go place by place from the start of π, every touch kept.
   */
  private shows(run: Run): boolean {
    return run.start === 0 && !run.overwritten && (run.checked || this.tweaks.includeUnchecked());
  }
}

export const dateAndTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function seconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)} s`;
}
