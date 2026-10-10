import { Component, computed, inject, InjectionToken, signal } from '@angular/core';
import { DeveloperMode } from '../developer/developer-mode';
import { Tweaks } from '../developer/tweaks';
import { PageHeader } from '../page-header/page-header';
import { backupFileName, readBackup, writeBackup } from '../runs/backup';
import { Run } from '../runs/run';
import { RUN_CLOCK, RunRecorder } from '../runs/run-recorder';
import { IS_PREVIEW, RunStore } from '../runs/run-store';
import { aggregate, analyzeRun, isConfident } from '../timing/timing-model';
import { GroupingSettingsPanel } from './grouping-settings-panel';
import { RunChart } from './run-chart';
import { ChartBreak, chartTop, digitTimes } from './run-charts';

/** Hands a file to the player, as a download. */
export const SAVE_FILE = new InjectionToken<(name: string, text: string) => void>('SAVE_FILE', {
  factory: () => (name, text) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    // Revoked later, once the browser has started the download.
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60_000);
  },
});

/**
 * The player's data, opened from the main menu's overflow menu: how many runs are kept and how safe they are, with a
 * backup file to save and restore, then a chart of each run and, sticking to the bottom, one of them all. In
 * developer mode, the settings of the timing model can be tuned between the two.
 */
@Component({
  selector: 'app-data',
  imports: [GroupingSettingsPanel, PageHeader, RunChart],
  host: { class: 'screen' },
  template: `
    <app-page-header title="Your data" />
    <section class="panel" aria-labelledby="backup-title">
      <h2 id="backup-title">Backup</h2>
      <p>{{ count() }}</p>
      @if (readOnlyPreview()) {
        <p>
          This preview of the game stores runs in a different format from the main game, so it
          doesn't keep any.
        </p>
      }
      <p>
        @if (persisted()) {
          Your browser keeps them until this site's data is cleared.
        } @else {
          Your browser may delete them when your device runs low on space.
        }
        A backup file keeps them safe even then.
      </p>
      <div class="buttons">
        <button type="button" class="candy" (click)="save()">Save a backup</button>
        @if (!readOnlyPreview()) {
          <label class="candy">
            Restore a backup
            <input
              type="file"
              accept=".json,application/json"
              class="visually-hidden"
              (change)="restore($event)"
            />
          </label>
        }
      </div>
      <p class="message" role="status">{{ message() }}</p>
    </section>
    @if (developerMode()) {
      <app-grouping-settings-panel />
    }
    <section class="runs" aria-labelledby="runs-title">
      <h2 id="runs-title">Your runs</h2>
      @if (charts().length === 0) {
        <p>None yet: each game you play shows up here.</p>
      } @else {
        <p>
          How long you took to type each digit, so pauses are peaks, along every place you've
          reached. Each run's own pauses split it into groups.
        </p>
        <ul class="legend">
          <li><i class="time"></i>Time per digit</li>
          <li><i class="pace"></i>Pace around it</li>
          <li><i class="threshold"></i>Pause threshold</li>
          <li><i class="break"></i>Break between groups</li>
          <li><i class="trust"></i>Trust, or confidence for all runs</li>
        </ul>
        @for (chart of charts(); track chart.id) {
          <article class="panel">
            <h3>{{ chart.title }}</h3>
            <p class="meta">{{ chart.meta }}</p>
            <app-run-chart
              [values]="chart.times"
              [pace]="chart.pace"
              [threshold]="chart.threshold"
              [breaks]="chart.breaks"
              [trust]="chart.trust"
              [places]="places()"
              [top]="top()"
              [label]="'Time per digit, ' + chart.title"
            />
          </article>
        }
        <article class="panel summary">
          <h3>All runs</h3>
          <p class="meta">{{ aggregateMeta() }}</p>
          <app-run-chart
            [values]="aggregateChart().times"
            [breaks]="aggregateChart().breaks"
            [trust]="aggregateChart().confidence"
            [places]="places()"
            [top]="top()"
            label="Time per digit over all runs, recent ones weighing more, with the breaks they agree on"
          />
          <p class="axis" aria-hidden="true">
            <span>Place 1</span><span>Place {{ places() }}</span>
          </p>
          <ul class="groups" aria-label="Your groups">
            @for (group of groups(); track group.start) {
              <li [class.unsure]="!group.confident">{{ group.digits }}</li>
            }
          </ul>
        </article>
      }
    </section>
  `,
  styleUrl: './data.css',
})
export class Data {
  protected readonly count = signal('');
  protected readonly persisted = signal(false);
  /** Whether this is a preview that can't keep runs (see {@link RunStore}). */
  protected readonly readOnlyPreview = signal(false);
  protected readonly message = signal('');

  /** In developer mode, the settings of the timing model can be tuned here. */
  protected readonly developerMode = inject(DeveloperMode).enabled;
  private readonly settings = inject(Tweaks).grouping;
  private readonly runs = signal<readonly Run[]>([]);
  /** What the timing model makes of each run, oldest first. */
  private readonly analyses = computed(() =>
    this.runs().map((run) => analyzeRun(run.times, this.settings())),
  );
  protected readonly charts = computed(() =>
    this.runs().map((run, r) => {
      const places = this.analyses()[r] ?? [];
      const breaks = breaksOf(places);
      return {
        id: run.id,
        title: dateAndTime.format(run.startedAt),
        meta:
          `${plural(run.digits.length, 'digit')} in ${seconds(run.times.at(-1) ?? 0)}` +
          (run.digits.length > 0 ? ` · ${plural(breaks.length + 1, 'group')}` : ''),
        times: digitTimes(run),
        pace: places.map((place) => place?.pace),
        threshold: places.map((place) => place?.threshold),
        breaks,
        trust: places.map((place) => place?.trust),
      };
    }),
  );
  /** Every chart spans the places of the longest run. */
  protected readonly places = computed(() =>
    Math.max(1, ...this.runs().map((run) => run.digits.length)),
  );
  protected readonly top = computed(() => chartTop(this.charts().map((chart) => chart.times)));
  /** The runs' verdicts combined: the groups the game plays with. */
  private readonly aggregate = computed(() => aggregate(this.analyses(), this.settings()));
  protected readonly aggregateChart = computed(() => {
    const places = this.aggregate().places;
    return {
      times: places.map((place) => place?.time),
      breaks: places.flatMap((place, i) =>
        place?.isBreak === true ? [{ place: i, strength: place.confidence }] : [],
      ),
      confidence: places.map((place) => place?.confidence),
    };
  });
  /** Every run types the digits of π, so the longest one has the digits of every group. */
  private readonly digits = computed(() =>
    this.runs().reduce(
      (longest, run) => (run.digits.length > longest.length ? run.digits : longest),
      '',
    ),
  );
  protected readonly groups = computed(() =>
    this.aggregate().groups.map((group) => ({
      start: group.start,
      digits: this.digits().slice(group.start, group.start + group.size),
      confident: isConfident(group, this.settings()),
    })),
  );
  protected readonly aggregateMeta = computed(() => {
    const confident = this.groups().filter((group) => group.confident).length;
    return `${plural(this.groups().length, 'group')}, ${String(confident)} sure enough to set the hint; dotted ones get the default of 5`;
  });

  private readonly store = inject(RunStore);
  private readonly recorder = inject(RunRecorder);
  private readonly clock = inject(RUN_CLOCK);
  private readonly saveFile = inject(SAVE_FILE);
  private readonly preview = inject(IS_PREVIEW);

  constructor() {
    void this.refresh();
  }

  protected async save(): Promise<void> {
    await this.recorder.saved();
    const runs = await this.store.runs();
    const now = this.clock.epoch();
    this.saveFile(backupFileName(now), writeBackup(runs, now));
    this.message.set(`Saved ${plural(runs.length, 'run')} in the backup.`);
  }

  protected async restore(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) {
      return;
    }
    const contents = readBackup(await file.text());
    if ('error' in contents) {
      this.message.set(contents.error);
      return;
    }
    const added = await this.store.addRuns(contents.runs);
    await this.refresh();
    const unreadable =
      contents.skipped > 0 ? ` ${plural(contents.skipped, 'run')} in it could not be read.` : '';
    this.message.set(
      (added > 0
        ? `Added ${plural(added, 'run')} from the backup.`
        : 'Every run in this backup is already here.') + unreadable,
    );
  }

  private async refresh(): Promise<void> {
    await this.recorder.saved();
    const [runs, persisted, writable] = await Promise.all([
      this.store.runs(),
      this.store.persisted(),
      this.store.writable(),
    ]);
    this.runs.set(runs);
    this.readOnlyPreview.set(this.preview && !writable);
    this.count.set(
      runs.length === 0
        ? 'No runs kept yet.'
        : `${plural(runs.length, 'run')} kept on this device.`,
    );
    this.persisted.set(persisted);
  }
}

function breaksOf(
  places: readonly ({ isBreak: boolean; trust: number } | undefined)[],
): ChartBreak[] {
  return places.flatMap((place, i) =>
    place?.isBreak === true ? [{ place: i, strength: place.trust }] : [],
  );
}

const dateAndTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function seconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)} s`;
}

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}
