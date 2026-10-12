import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DeveloperMode } from '../developer/developer-mode';
import { Tweaks } from '../developer/tweaks';
import { PageHeader } from '../page-header/page-header';
import { PI_DECIMALS } from '../pi/pi-decimals';
import { groupRuns, playOrder, Run } from '../runs/run';
import { RUN_CLOCK, RunRecorder } from '../runs/run-recorder';
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
 * staying in view of the chart of them all, and a long press on a run plays from it, as if it and the runs after it had
 * never been played, until undone.
 */
@Component({
  selector: 'app-your-runs',
  imports: [GroupingSettingsPanel, LongPress, NgTemplateOutlet, PageHeader, RunChart],
  host: { class: 'screen' },
  template: `
    <app-page-header title="Your runs">
      <button
        type="button"
        class="candy danger small"
        [disabled]="runs().length === 0"
        (click)="deleteAll()"
      >
        Delete all runs
      </button>
    </app-page-header>
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
            Delete unchecked runs
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
          reached. Breaks are drawn where they're more likely than not, the darker the more likely.
        </p>
        <ul class="legend">
          <li><i class="time"></i>Time per digit</li>
          <li><i class="baseline"></i>Baseline</li>
          <li><i class="break"></i>Break</li>
          <li><i class="confidence"></i>Confidence trend, for all runs</li>
        </ul>
        @for (chart of charts(); track chart.id) {
          @if (chart.here) {
            <ng-container [ngTemplateOutlet]="here" />
          }
          <article
            class="panel"
            [class.unchecked]="!chart.checked"
            [class.later]="chart.later"
            [attr.tabindex]="developerMode() ? 0 : null"
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
        }
        @if (hereAtEnd()) {
          <ng-container [ngTemplateOutlet]="here" />
        }
      }
    </section>
    <ng-template #here>
      <div class="here" role="group" aria-label="You are here">
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
    </ng-template>
    <!-- A run's context menu, opened by a long press on it, in developer mode. -->
    <div
      #runMenu
      class="run-menu"
      popover
      [style.top.px]="menuAt().y"
      [style.left.px]="menuAt().x"
      (toggle)="menuToggled($event)"
    >
      <button type="button" (click)="playFromPicked()">Play from here</button>
    </div>
    @if (charts().length > 0) {
      <article class="panel summary">
        <h3>{{ playFrom() === undefined ? 'All runs' : 'Runs before here' }}</h3>
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
  /** Where the game plays from, in developer mode, if anywhere. */
  protected readonly playFrom = this.tweaks.playFrom;
  protected readonly runs = signal<readonly Run[]>([]);
  protected readonly uncheckedRuns = computed(() => this.runs().filter((run) => !run.checked));
  /** The runs the groups are computed from, oldest first. */
  private readonly counted = computed(() =>
    groupRuns(this.runs(), this.includeUnchecked(), this.playFrom()),
  );
  /** The runs in the order the game takes them, and how many come before the line played from, if any. */
  private readonly order = computed(() => playOrder(this.runs(), this.playFrom()));
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
        here: this.playFrom() !== undefined && index === this.order().before,
        later: index >= this.order().before,
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

  /** Whether the line played from comes after all the runs. */
  protected readonly hereAtEnd = computed(
    () => this.playFrom() !== undefined && this.order().before === this.order().runs.length,
  );
  /** The run whose context menu is open, if any, and where the menu opens. */
  private readonly picked = signal<string | undefined>(undefined);
  protected readonly menuAt = signal({ x: 0, y: 0 });
  private readonly runMenu = viewChild.required<ElementRef<HTMLElement>>('runMenu');
  private readonly window = inject(DOCUMENT).defaultView;

  private readonly store = inject(RunStore);
  private readonly recorder = inject(RunRecorder);
  private readonly clock = inject(RUN_CLOCK);
  private readonly confirm = inject(CONFIRM);

  constructor() {
    void this.refresh();
  }

  protected setIncludeUnchecked(event: Event): void {
    void this.tweaks.setIncludeUnchecked((event.target as HTMLInputElement).checked);
  }

  /** Opens the context menu of a run long pressed, where it was pressed, in developer mode. */
  protected pick(id: string, at: { readonly x: number; readonly y: number }): void {
    if (!this.developerMode()) {
      return;
    }
    // Over the run pressed, within the window.
    const width = this.window?.innerWidth ?? Infinity;
    this.menuAt.set({
      x: Math.max(MENU_MARGIN, Math.min(at.x - MENU_WIDTH / 2, width - MENU_WIDTH - MENU_MARGIN)),
      y: at.y + 8,
    });
    this.picked.set(id);
    this.runMenu().nativeElement.showPopover();
  }

  protected menuToggled(event: Event): void {
    if ((event as ToggleEvent).newState === 'closed') {
      this.picked.set(undefined);
    }
  }

  /**
   * Plays from just before the run picked, as if only the runs before it had been played, in the order shown: if the
   * game already plays from somewhere, the runs keep the order it takes them in.
   */
  protected playFromPicked(): void {
    const at = this.order().runs.findIndex((run) => run.id === this.picked());
    const previous = this.playFrom();
    if (at !== -1) {
      void this.tweaks.setPlayFrom({
        at,
        since: this.clock.epoch(),
        ...(previous === undefined ? {} : { previous }),
      });
    }
    this.runMenu().nativeElement.hidePopover();
  }

  protected undoPlayFrom(): void {
    void this.tweaks.setPlayFrom(undefined);
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

/** The width of a run's context menu, and how close it comes to the sides of the window, in pixels. */
const MENU_WIDTH = 176;
const MENU_MARGIN = 12;

const dateAndTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function seconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)} s`;
}
