import {
  Component,
  computed,
  ElementRef,
  inject,
  InjectionToken,
  signal,
  viewChild,
} from '@angular/core';
import { DeveloperMode } from '../developer/developer-mode';
import { Tweaks } from '../developer/tweaks';
import { PageHeader } from '../page-header/page-header';
import { backupFileName, readBackup, writeBackup } from '../runs/backup';
import { PI_DECIMALS } from '../pi/pi-decimals';
import { groupRuns, Run } from '../runs/run';
import { RUN_CLOCK, RunRecorder } from '../runs/run-recorder';
import { RunStore } from '../runs/run-store';
import { breakModel, finishedRuns, Values } from '../timing/break-model';
import { GroupingSettingsPanel } from './grouping-settings-panel';
import { LongPress } from './long-press';
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

/** Asks the player to confirm something that can't be undone; resolves to whether they did. */
export const CONFIRM = new InjectionToken<(question: string) => boolean>('CONFIRM', {
  factory: () => (question) => confirm(question),
});

/**
 * The player's data, opened from the main menu's overflow menu: how many runs are kept and how safe they are, with a
 * backup file to save and restore, then a chart of each run and one of them all, sticking to the bottom of the whole
 * page. In developer mode, the hyperparameters of the break model can be tuned above the runs, staying in view of the
 * chart of them all, and a long press on a run plays from it, as if it and the runs after it had never been played,
 * until undone.
 */
@Component({
  selector: 'app-data',
  imports: [GroupingSettingsPanel, LongPress, PageHeader, RunChart],
  host: { class: 'screen' },
  template: `
    <app-page-header title="Your data" />
    <section class="panel" aria-labelledby="backup-title">
      <h2 id="backup-title">Backup</h2>
      <p>{{ count() }}</p>
      @if (separatePreview()) {
        <p>
          This preview of the game stores runs in a different format from the main game, so it keeps
          them apart: it has a copy of the main game's runs, and the runs played here stay here.
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
        <label class="candy">
          Restore a backup
          <input
            type="file"
            accept=".json,application/json"
            class="visually-hidden"
            (change)="restore($event)"
          />
        </label>
        <button
          type="button"
          class="candy danger"
          [disabled]="runs().length === 0"
          (click)="deleteAll()"
        >
          Delete all runs
        </button>
      </div>
      <p class="message" role="status">{{ message() }}</p>
    </section>
    @if (developerMode()) {
      <app-grouping-settings-panel>
        <div class="unchecked">
          <label class="check">
            <input
              type="checkbox"
              [checked]="includeUnchecked()"
              (change)="setIncludeUnchecked($event)"
            />
            Count unchecked runs
          </label>
          <p>{{ uncheckedNote() }}</p>
          <button
            type="button"
            class="candy danger"
            [disabled]="uncheckedRuns().length === 0"
            (click)="deleteUnchecked()"
          >
            Delete unchecked runs
          </button>
        </div>
      </app-grouping-settings-panel>
    }
    <section class="runs" aria-labelledby="runs-title">
      <h2 id="runs-title">Your runs</h2>
      @if (charts().length === 0) {
        <p>None yet: each game you play shows up here.</p>
      } @else {
        <p>
          How long you took to type each digit, so pauses are peaks, along every place you've
          reached. Breaks are drawn where they're more likely than not, the darker the more likely.
        </p>
        <ul class="legend">
          <li><i class="time"></i>Time per digit</li>
          <li><i class="baseline"></i>Baseline</li>
          <li><i class="break"></i>Break</li>
          <li><i class="confidence"></i>Confidence trend, for all runs</li>
        </ul>
        @for (chart of charts(); track chart.id) {
          @if (chart.id === playFrom()) {
            <div class="here" role="group" aria-label="You are here">
              <span>You are here</span>
              <button type="button" class="frosted pill" (click)="undoPlayFrom()">Undo</button>
            </div>
          }
          <article
            class="panel"
            [class.unchecked]="!chart.checked"
            [class.later]="chart.later"
            [attr.tabindex]="developerMode() ? 0 : null"
            (appLongPress)="pick(chart)"
          >
            <h3>
              {{ chart.title }}
              @if (!chart.checked) {
                <span class="badge">Unchecked</span>
              }
            </h3>
            <p class="meta">{{ chart.meta }}</p>
            <app-run-chart
              [values]="chart.times"
              [baseline]="chart.baseline"
              [breaks]="chart.breaks"
              [places]="places()"
              [top]="top()"
              [label]="'Time per digit, ' + chart.title"
            />
          </article>
        }
      }
    </section>
    <dialog
      #playFromDialog
      class="card"
      aria-labelledby="play-from-title"
      (close)="picked.set(undefined)"
    >
      @if (picked(); as chart) {
        <h2 id="play-from-title">Play from here?</h2>
        <p>
          The game will play as if this run, of {{ chart.title }}, and the ones after it had never
          been played: your groups and the chart of all runs leave them out. The runs you play
          meanwhile are still kept, and count again once you undo.
        </p>
        <button type="button" class="candy primary" (click)="playFromPicked()">
          Play from here
        </button>
        <button type="button" class="candy" autofocus (click)="closePick()">Cancel</button>
      }
    </dialog>
    @if (charts().length > 0) {
      <article class="panel summary">
        <h3>{{ playFrom() === undefined ? 'All runs' : 'Runs before here' }}</h3>
        <p class="meta">{{ aggregateMeta() }}</p>
        <app-run-chart
          [values]="aggregateChart().times"
          [baseline]="aggregateChart().baseline"
          [breaks]="aggregateChart().breaks"
          [confidence]="aggregateChart().confidence"
          [places]="places()"
          [top]="top()"
          label="Time per digit over all runs, recent ones weighing more, with your usual break spots"
        />
        <p class="axis" aria-hidden="true">
          <span>Place 1</span><span>Place {{ places() }}</span>
        </p>
        <ul class="groups" aria-label="Your groups">
          @for (group of groups(); track group.start) {
            <li [class.unsure]="!group.trusted">{{ group.digits }}</li>
          }
        </ul>
      </article>
    }
  `,
  styleUrl: './data.css',
})
export class Data {
  /** Whether the runs have been read. */
  private readonly loaded = signal(false);
  protected readonly persisted = signal(false);
  /** Whether this is a preview keeping its runs apart from the main game's (see {@link RunStore}). */
  protected readonly separatePreview = signal(false);
  protected readonly message = signal('');

  /** In developer mode, the hyperparameters of the break model can be tuned here. */
  private readonly developer = inject(DeveloperMode);
  private readonly tweaks = inject(Tweaks);
  protected readonly developerMode = this.developer.enabled;
  private readonly settings = this.tweaks.grouping;
  protected readonly includeUnchecked = this.tweaks.includeUnchecked;
  /** The run played from, in developer mode, if any. */
  protected readonly playFrom = this.tweaks.playFrom;
  protected readonly runs = signal<readonly Run[]>([]);
  protected readonly uncheckedRuns = computed(() => this.runs().filter((run) => !run.checked));
  /** The runs the groups are computed from, oldest first. */
  private readonly counted = computed(() =>
    groupRuns(this.runs(), this.includeUnchecked(), this.playFrom()),
  );
  /** Where the runs played from start, if any: they're left out of the groups. */
  private readonly playedFrom = computed(() => {
    const index = this.runs().findIndex((run) => run.id === this.playFrom());
    return index === -1 ? this.runs().length : index;
  });
  /** What the break model makes of them: the groups the game plays with. */
  private readonly model = computed(() =>
    breakModel(
      finishedRuns(
        this.counted().map((run) => run.times),
        this.settings().window,
      ),
      undefined,
      this.settings(),
    ),
  );
  /** Unchecked runs, which may hold mistakes, only show in developer mode. */
  private readonly shown = computed(() =>
    this.runs().filter((run) => run.checked || this.developerMode()),
  );
  protected readonly charts = computed(() =>
    this.runs().flatMap((run, index) => {
      if (!run.checked && !this.developerMode()) {
        return [];
      }
      // Runs left out of the groups have only their times.
      const found = this.model().runs[this.counted().indexOf(run)];
      const breaks = breaksOf(found?.breakProbability ?? [], this.settings().breakThreshold);
      return {
        id: run.id,
        title: dateAndTime.format(run.startedAt),
        checked: run.checked,
        later: index >= this.playedFrom(),
        meta:
          `${plural(run.digits.length, 'digit')} in ${seconds(run.times.at(-1) ?? 0)}` +
          (run.digits.length > 0 ? ` · ${plural(breaks.length + 1, 'group')}` : ''),
        times: digitTimes(run),
        baseline: found?.baseline ?? [],
        breaks,
      };
    }),
  );
  protected readonly count = computed(() => {
    if (!this.loaded()) {
      return '';
    }
    const count = this.shown().length;
    return count === 0 ? 'No runs kept yet.' : `${plural(count, 'run')} kept on this device.`;
  });
  /** Every chart spans the places of the longest run. */
  protected readonly places = computed(() =>
    Math.max(1, ...this.shown().map((run) => run.digits.length)),
  );
  protected readonly top = computed(() => chartTop(this.charts().map((chart) => chart.times)));
  protected readonly aggregateChart = computed(() => {
    const model = this.model();
    return {
      times: model.averageTime,
      baseline: model.speedCurve,
      breaks: breaksOf(model.usual, this.settings().usualThreshold),
      confidence: model.confidenceTrend,
    };
  });
  protected readonly groups = computed(() =>
    this.model().groups.map((group) => ({
      start: group.start,
      digits: PI_DECIMALS.slice(group.start, group.start + group.size),
      trusted: group.trusted,
    })),
  );
  protected readonly aggregateMeta = computed(() => {
    const trusted = this.groups().filter((group) => group.trusted).length;
    return `${plural(this.groups().length, 'group')}, ${trusted === 0 ? 'none' : `the first ${String(trusted)}`} within the trust horizon; from the first dotted one on, the game plays groups of ${String(this.settings().startingSlots)} that grow until you pause`;
  });

  protected readonly uncheckedNote = computed(() => {
    const count = this.uncheckedRuns().length;
    return (
      `${count === 1 ? '1 run is' : `${String(count)} runs are`} unchecked: played without checking the digits, or before the game checked them, so they may hold mistakes. ` +
      `${count === 1 ? 'It counts' : 'They count'} in your groups only when this is on.`
    );
  });

  /** The run long pressed, to play from once the player confirms. */
  protected readonly picked = signal<{ readonly id: string; readonly title: string } | undefined>(
    undefined,
  );
  private readonly playFromDialog =
    viewChild.required<ElementRef<HTMLDialogElement>>('playFromDialog');

  private readonly store = inject(RunStore);
  private readonly recorder = inject(RunRecorder);
  private readonly clock = inject(RUN_CLOCK);
  private readonly saveFile = inject(SAVE_FILE);
  private readonly confirm = inject(CONFIRM);

  constructor() {
    void this.refresh();
  }

  protected setIncludeUnchecked(event: Event): void {
    void this.tweaks.setIncludeUnchecked((event.target as HTMLInputElement).checked);
  }

  /** Offers to play from a run long pressed, in developer mode. */
  protected pick(chart: { readonly id: string; readonly title: string }): void {
    if (!this.developerMode() || this.picked() !== undefined) {
      return;
    }
    this.picked.set(chart);
    this.playFromDialog().nativeElement.showModal();
  }

  protected playFromPicked(): void {
    const picked = this.picked();
    if (picked !== undefined) {
      void this.tweaks.setPlayFrom(picked.id);
    }
    this.closePick();
  }

  protected closePick(): void {
    this.playFromDialog().nativeElement.close();
  }

  protected undoPlayFrom(): void {
    void this.tweaks.setPlayFrom(undefined);
  }

  protected async save(): Promise<void> {
    await this.recorder.saved();
    const [runs, settings] = await Promise.all([this.store.runs(), this.store.settings()]);
    const now = this.clock.epoch();
    this.saveFile(backupFileName(now), writeBackup(runs, settings, now));
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
    await this.store.saveSettings(contents.settings);
    await Promise.all([this.developer.reload(), this.tweaks.reload(), this.refresh()]);
    const unreadable =
      contents.skipped > 0 ? ` ${plural(contents.skipped, 'run')} in it could not be read.` : '';
    const settings =
      Object.keys(contents.settings).length > 0 ? ' Its settings replace yours.' : '';
    this.message.set(
      (added > 0
        ? `Added ${plural(added, 'run')} from the backup.`
        : 'Every run in this backup is already here.') +
        unreadable +
        settings,
    );
  }

  /** Deletes every run kept, once the player confirms. */
  protected async deleteAll(): Promise<void> {
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

  /** Deletes the unchecked runs, once the player confirms. */
  protected async deleteUnchecked(): Promise<void> {
    await this.recorder.saved();
    const ids = this.uncheckedRuns().map((run) => run.id);
    if (
      !this.confirm(
        `Delete ${ids.length === 1 ? 'the unchecked run' : `the ${String(ids.length)} unchecked runs`}? Only a backup file can bring ${ids.length === 1 ? 'it' : 'them'} back.`,
      )
    ) {
      return;
    }
    await this.store.deleteRuns(ids);
    await this.refresh();
    this.message.set(`Deleted ${plural(ids.length, 'unchecked run')}.`);
  }

  private async refresh(): Promise<void> {
    await this.recorder.saved();
    const [runs, persisted, separate] = await Promise.all([
      this.store.runs(),
      this.store.persisted(),
      this.store.separate(),
    ]);
    this.runs.set(runs);
    this.loaded.set(true);
    this.separatePreview.set(separate);
    this.persisted.set(persisted);
  }
}

/** A break wherever the probability is over the threshold, the stronger the further over it. */
function breaksOf(probabilities: Values, threshold: number): ChartBreak[] {
  return probabilities.flatMap((p, i) =>
    p !== undefined && p > threshold
      ? [{ place: i, strength: (p - threshold) / (1 - threshold) }]
      : [],
  );
}

const dateAndTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function seconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)} s`;
}

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}
