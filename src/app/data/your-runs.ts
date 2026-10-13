import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import {
  afterNextRender,
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { ContextMenu, MenuEntry, SEPARATOR } from '../context-menu/context-menu';
import { DeveloperMode } from '../developer/developer-mode';
import { Tweaks } from '../developer/tweaks';
import { Page } from '../page/page';
import { PI_DECIMALS } from '../pi/pi-decimals';
import { groupRuns, moveRun, orderRuns, Run, RunOrder } from '../runs/run';
import { RunRecorder } from '../runs/run-recorder';
import { RunStore } from '../runs/run-store';
import { breakModel, finishedRuns, Values } from '../timing/break-model';
import { CONFIRM } from './confirm';
import { GroupingSettingsPanel } from './grouping-settings-panel';
import { LongPress } from './long-press';
import { plural } from './plural';
import { RunChart } from './run-chart';
import { ChartBreak, chartTop, digitTimes } from './run-charts';

/**
 * The player's runs, opened from the main menu's overflow menu: a chart of each run and one of them all, sticking to the
 * bottom of the whole page. In developer mode, the hyperparameters of the break model can be tuned above the runs,
 * staying in view of the chart of them all. A long press on a run opens its context menu, to delete it or, in developer
 * mode, play from it, as if it and the runs after it had never been played, until undone.
 */
@Component({
  selector: 'app-your-runs',
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    CdkScrollable,
    ContextMenu,
    GroupingSettingsPanel,
    LongPress,
    Page,
    RunChart,
  ],
  template: `
    <app-page title="Your Runs" cdkScrollable>
      <button
        pageAction
        type="button"
        class="candy danger small"
        [disabled]="runs().length === 0"
        (click)="deleteAll()"
      >
        Delete All Runs
      </button>
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
            <button
              type="button"
              class="candy danger"
              [disabled]="uncheckedRuns().length === 0"
              (click)="deleteUnchecked()"
            >
              Delete Unchecked Runs
            </button>
          </div>
        </app-grouping-settings-panel>
      }
      <section class="runs">
        <p class="message" role="status">{{ message() }}</p>
        @if (charts().length === 0) {
          @if (loaded()) {
            <p>None yet: each game you play shows up here.</p>
          }
        } @else {
          <p>
            How long you took to type each digit, so pauses are peaks, along every place you've
            reached. Breaks are drawn where they're more likely than not, the darker the more
            likely.
          </p>
          <ul class="legend">
            <li><i class="time"></i>Time per digit</li>
            <li><i class="baseline"></i>Baseline</li>
            <li><i class="break"></i>Break</li>
            <li><i class="confidence"></i>Confidence trend, for all runs</li>
          </ul>
          <!-- In developer mode, the runs can be dragged into another order, across the line too. -->
          <div
            class="list"
            cdkDropList
            cdkDropListLockAxis="y"
            [cdkDropListDisabled]="!developerMode()"
            (cdkDropListDropped)="dropped($event)"
          >
            @for (row of rows(); track row.id; let index = $index) {
              @if (row.chart; as chart) {
                <div class="run" cdkDrag cdkDragPreviewContainer="parent">
                  <!-- In developer mode, a handle to drag the run to another place. -->
                  @if (developerMode()) {
                    <button
                      type="button"
                      class="handle"
                      cdkDragHandle
                      [attr.data-run]="chart.id"
                      [attr.aria-label]="'Move the run of ' + chart.title + ', with the arrow keys'"
                      (keydown)="step(chart.id, index, $event)"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="9" cy="6" r="1.75" />
                        <circle cx="15" cy="6" r="1.75" />
                        <circle cx="9" cy="12" r="1.75" />
                        <circle cx="15" cy="12" r="1.75" />
                        <circle cx="9" cy="18" r="1.75" />
                        <circle cx="15" cy="18" r="1.75" />
                      </svg>
                    </button>
                  }
                  <article
                    class="panel"
                    [class.unchecked]="!chart.checked"
                    [class.later]="chart.later"
                    tabindex="0"
                    (appLongPress)="pick(chart.id, $event)"
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
                </div>
              } @else {
                <div class="here" cdkDrag cdkDragDisabled role="group" aria-label="You are here">
                  <span>You are here</span>
                  <button
                    type="button"
                    class="undo"
                    aria-label="Play from after all the runs again"
                    (click)="undoPlayFrom()"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 14 4 9l5-5" />
                      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                    </svg>
                  </button>
                </div>
              }
            }
          </div>
        }
      </section>
      <!-- A run's context menu, opened by a long press on it. -->
      <app-context-menu [entries]="runMenuEntries()" />
      @if (charts().length > 0) {
        <article class="panel summary">
          <h3>{{ order().line === undefined ? 'All runs' : 'Runs before here' }}</h3>
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
          <ul class="groups" aria-label="Your groups" tabindex="0">
            @for (group of groups(); track group.start) {
              <li [class.unsure]="!group.trusted">{{ group.digits }}</li>
            }
          </ul>
        </article>
      }
    </app-page>
  `,
  styleUrl: './your-runs.css',
})
export class YourRuns {
  /** Whether the runs have been read. */
  protected readonly loaded = signal(false);
  protected readonly message = signal('');

  /** In developer mode, the hyperparameters of the break model can be tuned here. */
  protected readonly developerMode = inject(DeveloperMode).enabled;
  private readonly tweaks = inject(Tweaks);
  private readonly settings = this.tweaks.grouping;
  protected readonly includeUnchecked = this.tweaks.includeUnchecked;
  /** The order the game takes the runs in, and the line it plays from among them, in developer mode. */
  private readonly runOrder = this.tweaks.runOrder;
  protected readonly runs = signal<readonly Run[]>([]);
  protected readonly uncheckedRuns = computed(() => this.runs().filter((run) => !run.checked));
  /** The runs the groups are computed from, oldest first. */
  private readonly counted = computed(() =>
    groupRuns(this.runs(), this.includeUnchecked(), this.runOrder()),
  );
  /** The runs in the order the game takes them, and how many are above the line played from, if any. */
  protected readonly order = computed(() => orderRuns(this.runs(), this.runOrder()));
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
    this.order().runs.flatMap((run, index) => {
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
        later: index >= (this.order().line ?? Infinity),
        meta:
          `${plural(run.digits.length, 'digit')} in ${seconds(run.times.at(-1) ?? 0)}` +
          (run.digits.length > 0 ? ` · ${plural(breaks.length + 1, 'group')}` : ''),
        times: digitTimes(run),
        baseline: found?.baseline ?? [],
        breaks,
      };
    }),
  );
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

  /** The runs, and the line played from among them, if any. */
  protected readonly rows = computed(() => {
    const rows = this.charts().map((chart) => ({ id: chart.id, chart }));
    const line = this.order().line;
    return line === undefined
      ? rows
      : [...rows.slice(0, line), { id: '', chart: undefined }, ...rows.slice(line)];
  });
  /** The order of the runs shown, to change. */
  private readonly shownOrder = computed((): RunOrder => {
    const { runs, line } = this.order();
    const ids = runs.map((run) => run.id);
    return line === undefined ? { ids } : { ids, line };
  });
  /** The run whose context menu was last opened. */
  private picked: string | undefined;
  private readonly runMenu = viewChild.required(ContextMenu);
  /** What a run's context menu offers. */
  protected readonly runMenuEntries = computed((): MenuEntry[] => [
    {
      label: 'Delete Run',
      action: () => {
        void this.deletePicked();
      },
    },
    SEPARATOR,
    ...(this.developerMode()
      ? [
          {
            label: 'Play from Here',
            action: () => {
              this.playFromPicked();
            },
          },
        ]
      : []),
  ]);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly store = inject(RunStore);
  private readonly recorder = inject(RunRecorder);
  private readonly confirm = inject(CONFIRM);

  constructor() {
    void this.refresh();
  }

  protected setIncludeUnchecked(event: Event): void {
    void this.tweaks.setIncludeUnchecked((event.target as HTMLInputElement).checked);
  }

  /** Opens the context menu of a run long pressed, where it was pressed. */
  protected pick(id: string, at: { readonly x: number; readonly y: number }): void {
    this.picked = id;
    this.runMenu().open(at);
  }

  /** Plays from just before the run picked, as if only the runs above it had been played, keeping the order shown. */
  private playFromPicked(): void {
    const { ids } = this.shownOrder();
    const line = ids.indexOf(this.picked ?? '');
    if (line !== -1) {
      void this.tweaks.setRunOrder({ ids, line });
    }
  }

  /** Plays from after all the runs again, keeping them in the order shown. */
  protected undoPlayFrom(): void {
    void this.tweaks.setRunOrder({ ids: this.shownOrder().ids });
  }

  /** Moves a run dropped somewhere else among the runs and the line, in developer mode, where all of them show. */
  protected dropped({ previousIndex, currentIndex }: CdkDragDrop<unknown>): void {
    this.move(previousIndex, currentIndex);
    // The drop has just put the rows back in their old places and stopped them making room for the run: show them in
    // their new order at once, before the page is drawn, or they jump back and forth for a frame.
    this.changeDetector.detectChanges();
  }

  /** Moves a run up or down by one place with the arrow keys on its handle, which keeps the focus. */
  protected step(id: string, index: number, event: KeyboardEvent): void {
    const to = index + (ARROW_STEPS[event.key] ?? 0);
    if (to === index || to < 0 || to >= this.rows().length) {
      return;
    }
    event.preventDefault();
    this.move(index, to);
    afterNextRender(
      {
        write: () => {
          this.host.querySelector<HTMLElement>(`[data-run="${id}"]`)?.focus();
        },
      },
      { injector: this.injector },
    );
  }

  private move(from: number, to: number): void {
    if (from !== to) {
      void this.tweaks.setRunOrder(moveRun(this.shownOrder(), from, to));
    }
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

  /** Deletes the run picked, once the player confirms. */
  private async deletePicked(): Promise<void> {
    const id = this.picked;
    await this.recorder.saved();
    if (
      id === undefined ||
      !this.confirm('Delete this run? Only a backup file can bring it back.')
    ) {
      return;
    }
    await this.store.deleteRuns([id]);
    await this.refresh();
    this.message.set('Deleted the run.');
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
    this.runs.set(await this.store.runs());
    this.loaded.set(true);
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

/** How far each arrow key moves a run. */
const ARROW_STEPS: Partial<Record<string, number>> = { ArrowUp: -1, ArrowDown: 1 };

const dateAndTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function seconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)} s`;
}
