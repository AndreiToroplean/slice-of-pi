import { computed, inject, Injectable, InjectionToken, Signal, signal } from '@angular/core';
import { Tweaks } from '../../developer-mode/tweaks';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { groupRuns, orderRuns, Run } from '../../player-data/run';
import { RunRecorder } from '../../player-data/run-recorder';
import { RunStore } from '../../player-data/run-store';
import { CONFIRM } from '../../ui/confirm';
import { plural } from '../../ui/plural';
import { ShownGroup } from './group-list';
import { chartTop, digitTimes } from './run-charts';
import type { RunCardChart } from './run-card';

/** Whether a page of the runs shows the unchecked ones too, which may hold mistakes. */
export const WITH_UNCHECKED = new InjectionToken<Signal<boolean>>('WITH_UNCHECKED', {
  factory: () => signal(false),
});

/**
 * The player's runs as a page of them shows them, provided by each such page: read as it opens, in the order the game
 * takes them, what the break model makes of them, the chart of each and of all of them, and deleting them. The tweaks
 * apply, as they do to the whole game.
 */
@Injectable()
export class RunsState {
  /** Whether the runs have been read. */
  readonly loaded = signal(false);
  /** What the page last did, for screen readers too. */
  readonly message = signal('');
  readonly runs = signal<readonly Run[]>([]);

  private readonly tweaks = inject(Tweaks);
  private readonly withUnchecked = inject(WITH_UNCHECKED);
  private readonly store = inject(RunStore);
  private readonly recorder = inject(RunRecorder);
  private readonly confirm = inject(CONFIRM);

  /** The runs the groups are computed from, oldest first. */
  readonly counted = computed(() =>
    groupRuns(this.runs(), this.tweaks.includeUnchecked(), this.tweaks.runOrder()),
  );
  /** The runs in the order the game takes them, and how many are above the line played from, if any. */
  readonly order = computed(() => orderRuns(this.runs(), this.tweaks.runOrder()));
  readonly countedTimes = computed(() => this.counted().map((run) => run.times));
  /** What the break model makes of them: the groups the game plays with. */
  readonly stats = computed(() => this.tweaks.breakModel().stats(this.countedTimes()));
  /** The runs shown, by their chart, in the order the game takes them. */
  readonly charts = computed(() =>
    this.order().runs.flatMap((run, index): RunCardChart[] => {
      if (!run.checked && !this.withUnchecked()) {
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
        .filter((run) => run.checked || this.withUnchecked())
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
  /** What the runs counted are called, as a whole. */
  readonly aggregateTitle = computed(() =>
    this.order().line === undefined ? 'All runs' : 'Runs before here',
  );

  constructor() {
    void this.refresh();
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
    await this.refresh();
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
    await this.refresh();
    this.message.set(done);
  }

  /** Reads the runs again. */
  async refresh(): Promise<void> {
    await this.recorder.saved();
    this.runs.set(await this.store.runs());
    this.loaded.set(true);
  }
}

export const dateAndTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function seconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)} s`;
}
