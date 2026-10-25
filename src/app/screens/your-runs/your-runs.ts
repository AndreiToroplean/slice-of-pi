import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { NgTemplateOutlet } from '@angular/common';
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
import { Carousel } from '../../ui/carousel';
import { Router } from '@angular/router';
import { DropdownMenu } from '../../ui/dropdown-menu';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { Page } from '../../ui/page';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { groupRuns, moveRun, orderRuns, Run, RunOrder } from '../../player-data/run';
import { RunRecorder } from '../../player-data/run-recorder';
import { RunStore } from '../../player-data/run-store';
import { CONFIRM } from '../../ui/confirm';
import { FitToGroupingsDialog } from './fit-to-groupings-dialog';
import { GroupingSettingsPanel } from './grouping-settings-panel';
import { LongPress } from '../../ui/long-press';
import { GroupList } from './group-list';
import { GroupPerspective } from './group-perspective';
import { MyGroupings } from './my-groupings';
import { PlacePerspective } from './place-perspective';
import { groupViews } from './views/group-views';
import { modelViews } from './views/model-views';
import { Key, keyIdOf, Plot, Range } from './views/plot';
import { PlotLegend, toggledIn } from './views/plot-legend';
import { PlotView } from './views/plot-view';
import { Zoom } from './views/zoom';
import { plural } from '../../ui/plural';
import { RunChart } from './run-chart';
import { chartTop, digitTimes } from './run-charts';
import { Candy } from '../../ui/candy';
import { Segment, Segmented } from '../../ui/segmented';

/**
 * The player's runs, opened from the main menu's overflow menu, on one screen: a chart of them all on top, and under it
 * a chart of each run, scrolling. In developer mode, the chart on top steps through what the break model makes of the
 * runs, in two perspectives: along the places, over the runs, or across the runs at the place picked by tapping a chart
 * of the first. Tabs beside the runs hold sliders for the hyperparameters of the break model, so they can be tuned in
 * view of the chart of them all, and never moved by scrolling, and a dialog fits them to the player's own groups. A
 * long press on a run opens its context menu, to watch its replay, delete it, or, in developer mode, play from after
 * it, as if the runs after it had never been played, until undone; one on all runs, in developer mode, to play from
 * before them all, as if none had been played.
 */
@Component({
  selector: 'app-your-runs',
  imports: [
    Candy,
    Segmented,
    Carousel,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    CdkScrollable,
    DropdownMenu,
    FitToGroupingsDialog,
    GroupingSettingsPanel,
    LongPress,
    NgTemplateOutlet,
    Page,
    GroupList,
    GroupPerspective,
    PlacePerspective,
    PlotLegend,
    PlotView,
    RunChart,
    Zoom,
  ],
  template: `
    <app-page heading="Your Runs">
      <button
        pageAction
        type="button"
        appCandy="danger"
        class="small"
        [disabled]="runs().length === 0"
        (click)="deleteAll()"
      >
        Delete All Runs
      </button>
      @if (charts().length > 0) {
        <article class="panel summary">
          @if (developerMode()) {
            <!--
              In developer mode, the steps of the break model, one after the other: along the places, over the runs,
              or at the place picked on them, across the runs.
            -->
            <div class="perspectives">
              <span aria-hidden="true">Perspective</span>
              <app-segmented
                label="Perspective"
                panels="perspective"
                [segments]="PERSPECTIVES"
                [(value)]="perspective"
              />
            </div>
            <div
              role="tabpanel"
              id="perspective-run"
              aria-labelledby="perspective-tab-run"
              [hidden]="perspective() !== 'run'"
            >
              <app-carousel label="The break model along the places, step by step">
                <section class="view">
                  <div class="heading">
                    <h3>{{ summaryTitle() }}</h3>
                    <span class="step">1/{{ views().length + 1 }}</span>
                  </div>
                  <ng-container [ngTemplateOutlet]="timesChart" />
                  <app-plot-legend
                    [keys]="TIMES_KEYS"
                    [hidden]="hiddenTimes()"
                    (toggled)="toggleTimes($event)"
                  />
                  <p class="caption">
                    The time per digit, along the places, recent runs weighing more. Tap any chart
                    here to pick a place.
                  </p>
                </section>
                @for (plot of views(); track plot.title; let index = $index) {
                  <app-plot-view
                    class="view"
                    [plot]="plot"
                    [step]="index + 2 + '/' + (views().length + 1)"
                    [marker]="plot.x.places ? place() : undefined"
                    [(zoom)]="placeZoom"
                    (picked)="pickPlaceOn(plot, $event)"
                  />
                }
              </app-carousel>
            </div>
            <div
              role="tabpanel"
              id="perspective-place"
              aria-labelledby="perspective-tab-place"
              [hidden]="perspective() !== 'place'"
            >
              @if (steps(); as model) {
                @if (places() > 1) {
                  <app-place-perspective
                    [steps]="model"
                    [place]="place()"
                    [digitCount]="places()"
                    [picked]="pickedRuns()"
                    [titles]="titles()"
                    (placeChange)="pickedPlace.set($event)"
                  />
                } @else {
                  <p>No places yet: each game you play adds some.</p>
                }
              } @else {
                <p>This break model doesn’t show its steps.</p>
              }
            </div>
            <div
              role="tabpanel"
              id="perspective-group"
              aria-labelledby="perspective-tab-group"
              [hidden]="perspective() !== 'group'"
            >
              <app-group-perspective [groups]="groups()" [plots]="groupPlots()" />
            </div>
          } @else {
            <h3>{{ summaryTitle() }}</h3>
            <ng-container [ngTemplateOutlet]="timesChart" />
            <app-group-list [groups]="groups()" />
          }
        </article>
      }
      @if (developerMode()) {
        <app-grouping-settings-panel (told)="message.set($event)">
          <ng-container [ngTemplateOutlet]="runList" />
          <label menuItem class="toggle unchecked">
            <input
              type="checkbox"
              [checked]="includeUnchecked()"
              (change)="setIncludeUnchecked($event)"
            />
            Count Unchecked Runs
          </label>
          <button
            menuItem
            type="button"
            [disabled]="chronological()"
            (click)="reorderChronologically()"
          >
            Reorder Runs Chronologically
          </button>
          <button menuItem type="button" aria-haspopup="dialog" (click)="void fitDialog.open()">
            Fit to My Groupings
          </button>
          <hr menuItem />
          <button
            menuItem
            type="button"
            [disabled]="uncheckedRuns().length === 0"
            (click)="deleteUnchecked()"
          >
            Delete Unchecked Runs
          </button>
        </app-grouping-settings-panel>
        <app-fit-to-groupings-dialog #fitDialog [runs]="countedTimes()" />
      } @else {
        <ng-container [ngTemplateOutlet]="runList" />
      }
      <!-- A run's context menu, opened by a long press on it, or on all runs to play from before them. -->
      <app-dropdown-menu label="Run" [button]="false">
        @if (picked() !== ALL) {
          <button type="button" (click)="watchPicked()">Watch Replay</button>
          <button type="button" (click)="void deletePicked()">Delete Run</button>
        }
        @if (developerMode()) {
          @if (picked() !== ALL) {
            <hr />
          }
          <button type="button" (click)="playFromPicked()">Play from Here</button>
        }
      </app-dropdown-menu>
    </app-page>
    <!-- The chart of the times of all runs, and of the runs picked. -->
    <ng-template #timesChart>
      <app-run-chart
        [values]="aggregateShown() && timesShown(TIMES.time) ? aggregateChart().times : []"
        [baseline]="aggregateShown() && timesShown(TIMES.baseline) ? aggregateChart().baseline : []"
        [breaks]="aggregateShown() && timesShown(TIMES.breaks) ? aggregateChart().breaks : []"
        [confidence]="
          aggregateShown() && timesShown(TIMES.confidence) ? aggregateChart().confidence : []
        "
        [others]="timesShown(TIMES.others) ? selectedTimes() : []"
        [places]="places()"
        [top]="top()"
        [marker]="developerMode() ? place() : undefined"
        [window]="placeZoom()"
        [appZoom]="placeAxis()"
        [(zoom)]="placeZoom"
        label="Time per digit over all runs, recent ones weighing more, with your usual break spots"
        (picked)="pickPlace($event)"
      />
      <p class="axis" aria-hidden="true">
        <span>{{ placeLabels()[0] }}</span
        ><span>{{ placeLabels()[1] }}</span>
      </p>
    </ng-template>
    <!-- The runs, scrolling under the chart of them all: the only part of the page that scrolls. -->
    <ng-template #runList>
      <section class="runs" cdkScrollable>
        <p class="message" role="status">{{ message() }}</p>
        @if (charts().length === 0) {
          @if (loaded()) {
            <p>None yet: each game you play shows up here.</p>
          }
        } @else {
          <ul class="legend">
            <li><i class="time"></i>Time per digit</li>
            <li><i class="baseline"></i>Baseline</li>
            <li><i class="break"></i>Break</li>
            <li><i class="confidence"></i>Confidence trend, for all runs</li>
          </ul>
          @if (developerMode()) {
            <!-- In developer mode, the chart of all runs can be left out of the chart on top, and runs added to it. -->
            <button
              type="button"
              class="panel aggregate"
              [class.selected]="aggregateShown()"
              [attr.aria-pressed]="aggregateShown()"
              (appLongPress)="pick(ALL, $event)"
              (appTap)="aggregateShown.set(!aggregateShown())"
              (click)="clickAggregate($event)"
            >
              <span class="title">{{
                order().line === undefined ? 'All runs' : 'Runs before here'
              }}</span>
              <span class="meta">{{ plural(counted().length, 'run') }}</span>
            </button>
          }
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
                <div class="run panel" cdkDrag cdkDragPreviewContainer="parent">
                  <!-- In developer mode, a handle in the run's card to drag it to another place. -->
                  @if (developerMode()) {
                    <button
                      type="button"
                      class="handle"
                      cdkDragHandle
                      [attr.data-run]="chart.id"
                      [title]="'Move the run of ' + chart.title + ', with the arrow keys'"
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
                    [class.unchecked]="!chart.checked"
                    [class.later]="chart.later"
                    [class.selected]="selected().has(chart.id)"
                    [attr.role]="developerMode() ? 'button' : null"
                    [attr.aria-pressed]="developerMode() ? selected().has(chart.id) : null"
                    tabindex="0"
                    (appLongPress)="pick(chart.id, $event)"
                    (appTap)="select(chart.id)"
                    (keydown.enter)="select(chart.id)"
                    (keydown.space)="select(chart.id, $event)"
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
                      [window]="placeZoom()"
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
                    title="Play from after all the runs again"
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
    </ng-template>
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
  protected readonly countedTimes = computed(() => this.counted().map((run) => run.times));
  /** What the break model makes of them: the groups the game plays with. */
  private readonly stats = computed(() => this.tweaks.breakModel().stats(this.countedTimes()));
  /** In developer mode, what it makes of them step by step, if it can show that. */
  private readonly steps = computed(() =>
    this.developerMode()
      ? this.tweaks.breakModelKind().steps?.(this.tweaks.grouping(), this.countedTimes())
      : undefined,
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
      const found = this.stats().runs[this.counted().indexOf(run)];
      const breaks = found?.breaks ?? [];
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
  /**
   * The window of the places the charts show, zoomed into on the chart of all runs or the steps along the places: the
   * charts of the runs follow it. All of them if undefined.
   */
  protected readonly placeZoom = signal<Range | undefined>(undefined);
  /** All the places, by index, as the charts span them. */
  protected readonly placeAxis = computed(() => ({ min: 0, max: Math.max(this.places() - 1, 1) }));
  /** The ends of the places shown on the chart of all runs. */
  protected readonly placeLabels = computed(() => {
    const zoom = this.placeZoom();
    return zoom === undefined
      ? ['Place 1', `Place ${String(this.places())}`]
      : [`Place ${String(Math.round(zoom.min) + 1)}`, `Place ${String(Math.round(zoom.max) + 1)}`];
  });
  protected readonly top = computed(() => chartTop(this.charts().map((chart) => chart.times)));
  protected readonly aggregateChart = computed(() => {
    const stats = this.stats();
    return {
      times: stats.averageTime,
      baseline: stats.speedCurve,
      breaks: stats.usual,
      confidence: stats.confidence,
    };
  });
  protected readonly groups = computed(() =>
    this.stats().groups.map((group) => ({
      start: group.start,
      digits: PI_DECIMALS.slice(group.start, group.start + group.size),
      trusted: group.trusted,
    })),
  );

  protected readonly plural = plural;
  /** In developer mode, whether the chart on top shows all the runs, and which runs it shows besides. */
  protected readonly aggregateShown = signal(true);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly selectedTimes = computed(() =>
    this.developerMode()
      ? this.charts()
          .filter((chart) => this.selected().has(chart.id))
          .map((chart) => chart.times)
      : [],
  );
  /** In developer mode, which perspective on the break model the card on top shows. */
  protected readonly perspective = signal<Perspective>('run');
  protected readonly PERSPECTIVES = PERSPECTIVES;
  protected readonly TIMES_KEYS = TIMES_KEYS;
  protected readonly TIMES = TIMES;
  /** The marks of the chart of times hidden from its key, by id: only while the page is open, never saved. */
  protected readonly hiddenTimes = signal<ReadonlySet<string>>(new Set());
  /** The runs picked, by their index among the runs counted, as the steps have them. */
  protected readonly pickedRuns = computed(() =>
    this.counted().flatMap((run, k) => (this.selected().has(run.id) ? [k] : [])),
  );
  /** What each run counted is called, as the steps have them. */
  protected readonly titles = computed(() =>
    this.counted().map((run) => dateAndTime.format(run.startedAt)),
  );
  /**
   * In developer mode, the place the place perspective shows, and that the plots along the places mark: the
   * boundary before the digit at this index. Until one is picked, where the first group ends.
   */
  protected readonly pickedPlace = signal<number | undefined>(undefined);
  protected readonly place = computed(() => {
    const first = this.stats().groups.find((group) => !group.open);
    return Math.min(
      Math.max(1, this.places() - 1),
      this.pickedPlace() ?? (first === undefined ? 1 : first.start + first.size),
    );
  });
  /** In developer mode, the views along the digits of a group, the player's own groups among them if they're π. */
  protected readonly groupPlots = computed(() => {
    const steps = this.steps();
    const mine = this.myGroupings.mistake() === undefined ? this.myGroupings.groups() : [];
    return steps === undefined
      ? []
      : groupViews(
          {
            model: steps,
            picked: this.pickedRuns(),
            aggregate: this.aggregateShown(),
            places: this.places(),
          },
          mine.map((group) => group.length),
        );
  });
  /** In developer mode, the steps of the break model after the times, for all the runs and those picked. */
  protected readonly views = computed(() => {
    const steps = this.steps();
    return steps === undefined
      ? []
      : modelViews({
          model: steps,
          picked: this.pickedRuns(),
          aggregate: this.aggregateShown(),
          places: this.places(),
        });
  });
  protected readonly summaryTitle = computed(() => {
    const aggregate = this.order().line === undefined ? 'All runs' : 'Runs before here';
    if (!this.developerMode()) {
      return aggregate;
    }
    const count = this.selectedTimes().length;
    const runs = count === 0 ? '' : plural(count, 'run');
    return this.aggregateShown() ? [aggregate, runs].filter(Boolean).join(' and ') : runs;
  });

  /** The runs, and the line played from among them, if any. */
  protected readonly rows = computed(() => {
    const rows = this.charts().map((chart) => ({ id: chart.id, chart }));
    const line = this.order().line;
    return line === undefined
      ? rows
      : [...rows.slice(0, line), { id: '', chart: undefined }, ...rows.slice(line)];
  });
  /** Whether the runs are shown in the order they were played in. */
  protected readonly chronological = computed(() =>
    this.order().runs.every(
      (run, i, runs) => i === 0 || (runs[i - 1]?.startedAt ?? 0) <= run.startedAt,
    ),
  );
  /** The order of the runs shown, to change. */
  private readonly shownOrder = computed((): RunOrder => {
    const { runs, line } = this.order();
    const ids = runs.map((run) => run.id);
    return line === undefined ? { ids } : { ids, line };
  });
  /** The run whose context menu was last opened. */
  /** The id of the run whose context menu is open, or {@link ALL} for all of them. */
  protected readonly picked = signal<string | undefined>(undefined);
  protected readonly ALL = ALL;
  private readonly runMenu = viewChild.required(DropdownMenu);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly store = inject(RunStore);
  private readonly router = inject(Router);
  private readonly recorder = inject(RunRecorder);
  private readonly confirm = inject(CONFIRM);
  private readonly myGroupings = inject(MyGroupings);

  constructor() {
    void this.refresh();
  }

  protected setIncludeUnchecked(event: Event): void {
    void this.tweaks.setIncludeUnchecked((event.target as HTMLInputElement).checked);
  }

  /** Adds a run tapped to the chart on top, or takes it off, in developer mode. */
  protected select(id: string, event?: Event): void {
    if (!this.developerMode()) {
      return;
    }
    event?.preventDefault();
    this.selected.update((selected) => {
      const next = new Set(selected);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  /** Whether the marks of the chart of times under this key show: outside developer mode, all of them do. */
  protected timesShown(key: Key): boolean {
    return !this.developerMode() || !this.hiddenTimes().has(keyIdOf(key));
  }

  /** Hides or shows the marks of the chart of times under a key. */
  protected toggleTimes(id: string): void {
    this.hiddenTimes.update((hidden) => toggledIn(hidden, id));
  }

  /** Picks the place tapped on the chart of times, in developer mode, for the place perspective. */
  protected pickPlace(place: number): void {
    if (!this.developerMode()) {
      return;
    }
    this.pickedPlace.set(place);
  }

  /** Picks the place tapped on a plot along the places, if it's one. */
  protected pickPlaceOn(plot: Plot, x: number): void {
    if (plot.x.places === true) {
      this.pickPlace(Math.round(x));
    }
  }

  /** Opens the context menu of a run long pressed, where it was pressed. */
  protected pick(id: string, at: { readonly x: number; readonly y: number }): void {
    this.picked.set(id);
    this.runMenu().openAt(at);
  }

  /** Opens the replay of the run picked. */
  protected watchPicked(): void {
    void this.router.navigate(['/runs', this.picked(), 'replay']);
  }

  /**
   * Plays from just after the run picked, as if only the runs up to it had been played, or from before all of them,
   * keeping the order shown.
   */
  protected playFromPicked(): void {
    const { ids } = this.shownOrder();
    const picked = this.picked();
    const line = picked === ALL ? 0 : ids.indexOf(picked ?? '') + 1;
    if (line !== 0 || picked === ALL) {
      void this.tweaks.setRunOrder({ ids, line });
    }
  }

  /** Shows or leaves out the chart of all runs from the keyboard; taps do on their own, and long presses don't. */
  protected clickAggregate(event: MouseEvent): void {
    if (event.detail === 0) {
      this.aggregateShown.set(!this.aggregateShown());
    }
  }

  /** Plays from after all the runs again, keeping them in the order shown. */
  protected undoPlayFrom(): void {
    void this.tweaks.setRunOrder({ ids: this.shownOrder().ids });
  }

  /** Puts the runs back in the order they were played in, the line staying where it is, under as many runs. */
  protected reorderChronologically(): void {
    const { runs, line } = this.order();
    const ids = [...runs].sort((a, b) => a.startedAt - b.startedAt).map((run) => run.id);
    void this.tweaks.setRunOrder(line === undefined ? undefined : { ids, line });
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
  protected async deletePicked(): Promise<void> {
    const id = this.picked();
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
    await this.myGroupings.load();
    this.loaded.set(true);
  }
}

/** The marks of the chart of times, on top in developer mode, by the key each shows under. */
const TIMES = {
  time: { mark: 'line', role: 'aggregate', label: 'Time per digit' },
  baseline: { mark: 'line', role: 'run', label: 'Without breaks' },
  breaks: { mark: 'bars', role: 'break', label: 'Usual break' },
  confidence: { mark: 'area', role: 'faint', label: 'Confidence trend' },
  others: { mark: 'line', role: 'faint', label: 'Runs picked' },
} as const satisfies Record<string, Key>;

/** The key to the chart of times, drawn like its marks. */
const TIMES_KEYS: readonly Key[] = Object.values(TIMES);

/**
 * The perspectives on the break model, by what its steps are plotted along: the places, over the runs; the runs, at one
 * place; or the digits of a group.
 */
type Perspective = 'run' | 'place' | 'group';

const PERSPECTIVES: readonly Segment<Perspective>[] = [
  { value: 'run', label: 'Run' },
  { value: 'place', label: 'Place' },
  { value: 'group', label: 'Group' },
];

/** What's picked for the context menu when it's all runs rather than one: no run's id is empty. */
const ALL = '';

/** How far each arrow key moves a run. */
const ARROW_STEPS: Partial<Record<string, number>> = { ArrowUp: -1, ArrowDown: 1 };

const dateAndTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function seconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)} s`;
}
