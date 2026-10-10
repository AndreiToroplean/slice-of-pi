import { Component, computed, inject, InjectionToken, signal } from '@angular/core';
import { PageHeader } from '../page-header/page-header';
import { backupFileName, readBackup, writeBackup } from '../runs/backup';
import { Run } from '../runs/run';
import { RUN_CLOCK, RunRecorder } from '../runs/run-recorder';
import { IS_PREVIEW, RunStore } from '../runs/run-store';
import { RunChart } from './run-chart';
import { average, chartTop, digitTimes } from './run-charts';

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
 * backup file to save and restore, then a chart of each run and, sticking to the bottom, one of them all.
 */
@Component({
  selector: 'app-data',
  imports: [PageHeader, RunChart],
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
    <section class="runs" aria-labelledby="runs-title">
      <h2 id="runs-title">Your runs</h2>
      @if (charts().length === 0) {
        <p>None yet: each game you play shows up here.</p>
      } @else {
        <p>
          How long you took to type each digit, so pauses are peaks, along every place you've
          reached.
        </p>
        @for (chart of charts(); track chart.id) {
          <article class="panel">
            <h3>{{ chart.title }}</h3>
            <p class="meta">{{ chart.meta }}</p>
            <app-run-chart
              [values]="chart.times"
              [places]="places()"
              [top]="top()"
              [label]="'Time per digit, ' + chart.title"
            />
          </article>
        }
        <article class="panel summary">
          <h3>All runs</h3>
          <p class="meta">Average time per digit</p>
          <app-run-chart
            [values]="averageTimes()"
            [places]="places()"
            [top]="top()"
            label="Average time per digit, over all runs"
          />
          <p class="axis" aria-hidden="true">
            <span>Place 1</span><span>Place {{ places() }}</span>
          </p>
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

  private readonly runs = signal<readonly Run[]>([]);
  protected readonly charts = computed(() =>
    this.runs().map((run) => ({
      id: run.id,
      title: dateAndTime.format(run.startedAt),
      meta: `${plural(run.digits.length, 'digit')} in ${seconds(run.times.at(-1) ?? 0)}`,
      times: digitTimes(run),
    })),
  );
  /** Every chart spans the places of the longest run. */
  protected readonly places = computed(() =>
    Math.max(1, ...this.runs().map((run) => run.digits.length)),
  );
  protected readonly top = computed(() => chartTop(this.charts().map((chart) => chart.times)));
  protected readonly averageTimes = computed(() =>
    average(this.charts().map((chart) => chart.times)),
  );

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

const dateAndTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function seconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)} s`;
}

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}
