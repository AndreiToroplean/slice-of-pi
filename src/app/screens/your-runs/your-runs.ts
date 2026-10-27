import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
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
import { moveRun, RunOrder } from '../../player-data/run';
import { FitToGroupingsDialog } from './fit-to-groupings-dialog';
import { GroupingSettingsPanel } from './grouping-settings-panel';
import { LongPress } from '../../ui/long-press';
import { GroupList } from './group-list';
import { GroupPerspective } from './group-perspective';
import { MyGroupings } from './my-groupings';
import { PlacePerspective } from './place-perspective';
import { groupViews } from './views/group-views';
import { modelViews } from './views/model-views';
import { Key, Plot, Range } from './views/plot';
import { PlotView } from './views/plot-view';
import { plural } from '../../ui/plural';
import { Candy } from '../../ui/candy';
import { Segment, Segmented } from '../../ui/segmented';
import { RunCard } from './run-card';
import { dateAndTime, RunsState, WITH_UNCHECKED } from './runs-state';
import { SummaryCard } from './summary-card';
import { TIMES, TimesView } from './times-view';

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
    CdkDropList,
    CdkScrollable,
    FitToGroupingsDialog,
    GroupingSettingsPanel,
    LongPress,
    NgTemplateOutlet,
    Page,
    GroupList,
    GroupPerspective,
    PlacePerspective,
    PlotView,
    RunCard,
    DropdownMenu,
    SummaryCard,
    TimesView,
  ],
  providers: [
    RunsState,
    { provide: WITH_UNCHECKED, useFactory: () => inject(DeveloperMode).enabled },
  ],
  template: `
    <app-page heading="Your Runs">
      <button
        pageAction
        type="button"
        appCandy="danger"
        [disabled]="state.runs().length === 0"
        (click)="void state.deleteAll()"
      >
        Delete All Runs
      </button>
      @if (charts().length > 0) {
        <app-summary-card>
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
                <app-times-view
                  class="view"
                  [title]="summaryTitle()"
                  [step]="'1/' + (views().length + 1)"
                  [aggregate]="aggregateShown() ? state.aggregateChart() : undefined"
                  [others]="selectedTimes()"
                  [places]="places()"
                  [top]="top()"
                  [keys]="TIMES_KEYS"
                  caption="The time per digit, along the places, recent runs weighing more. Tap any chart here to pick a place."
                  [marker]="place()"
                  [(zoom)]="placeZoom"
                  (picked)="pickedPlace.set($event)"
                />
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
              <app-group-perspective [groups]="state.groups()" [plots]="groupPlots()" />
            </div>
          } @else {
            <app-times-view
              [title]="summaryTitle()"
              [aggregate]="state.aggregateChart()"
              [places]="places()"
              [top]="top()"
              [keys]="AGGREGATE_KEYS"
              [(zoom)]="placeZoom"
            >
              <app-group-list [groups]="state.groups()" />
            </app-times-view>
          }
        </app-summary-card>
      }
      @if (developerMode()) {
        <app-grouping-settings-panel (told)="state.message.set($event)">
          <ng-container [ngTemplateOutlet]="runList" />
          <button
            modelAction
            type="button"
            appCandy
            aria-haspopup="dialog"
            (click)="void fitDialog.open()"
          >
            Fit to My Groupings
          </button>
          <button
            menuItem
            type="button"
            [disabled]="chronological()"
            (click)="reorderChronologically()"
          >
            Reorder Runs Chronologically
          </button>
          <hr menuItem />
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
            [disabled]="uncheckedRuns().length === 0"
            (click)="void deleteUnchecked()"
          >
            Delete Unchecked Runs
          </button>
        </app-grouping-settings-panel>
        <app-fit-to-groupings-dialog #fitDialog [runs]="state.countedTimes()" />
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
    <!-- The runs, scrolling under the chart of them all: the only part of the page that scrolls. -->
    <ng-template #runList>
      <section class="runs" cdkScrollable>
        <p class="message" role="status">{{ state.message() }}</p>
        @if (charts().length === 0) {
          @if (state.loaded()) {
            <p>None yet: each game you play shows up here.</p>
          }
        } @else {
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
              <span class="title">{{ state.aggregateTitle() }}</span>
              <span class="meta">{{ plural(state.counted().length, 'run') }}</span>
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
                <app-run-card
                  cdkDrag
                  cdkDragPreviewContainer="parent"
                  [chart]="chart"
                  [places]="places()"
                  [top]="top()"
                  [window]="placeZoom()"
                  [selectable]="developerMode()"
                  [selected]="selected().has(chart.id)"
                  [reorderable]="developerMode()"
                  (pressed)="pick(chart.id, $event)"
                  (toggled)="select(chart.id)"
                  (moved)="step(chart.id, index, $event)"
                />
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
  protected readonly state = inject(RunsState);
  /** In developer mode, the hyperparameters of the break model can be tuned here. */
  protected readonly developerMode = inject(DeveloperMode).enabled;
  private readonly tweaks = inject(Tweaks);
  protected readonly includeUnchecked = this.tweaks.includeUnchecked;
  protected readonly uncheckedRuns = computed(() =>
    this.state.runs().filter((run) => !run.checked),
  );
  /** In developer mode, what the break model makes of the runs step by step, if it can show that. */
  private readonly steps = computed(() =>
    this.developerMode()
      ? this.tweaks.breakModelKind().steps?.(this.tweaks.grouping(), this.state.countedTimes())
      : undefined,
  );
  protected readonly charts = this.state.charts;
  protected readonly places = this.state.places;
  protected readonly top = this.state.top;
  /**
   * The window of the places the charts show, zoomed into on the chart of all runs or the steps along the places: the
   * charts of the runs follow it. All of them if undefined.
   */
  protected readonly placeZoom = signal<Range | undefined>(undefined);

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
  protected readonly AGGREGATE_KEYS = AGGREGATE_KEYS;
  /** The runs picked, by their index among the runs counted, as the steps have them. */
  protected readonly pickedRuns = computed(() =>
    this.state.counted().flatMap((run, k) => (this.selected().has(run.id) ? [k] : [])),
  );
  /** What each run counted is called, as the steps have them. */
  protected readonly titles = computed(() =>
    this.state.counted().map((run) => dateAndTime.format(run.startedAt)),
  );
  /**
   * In developer mode, the place the place perspective shows, and that the plots along the places mark: the
   * boundary before the digit at this index. Until one is picked, where the first group ends.
   */
  protected readonly pickedPlace = signal<number | undefined>(undefined);
  protected readonly place = computed(() => {
    const first = this.state.stats().groups.find((group) => !group.open);
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
    const aggregate = this.state.aggregateTitle();
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
    const line = this.state.order().line;
    return line === undefined
      ? rows
      : [...rows.slice(0, line), { id: '', chart: undefined }, ...rows.slice(line)];
  });
  /** Whether the runs are shown in the order they were played in. */
  protected readonly chronological = computed(() =>
    this.state
      .order()
      .runs.every((run, i, runs) => i === 0 || (runs[i - 1]?.startedAt ?? 0) <= run.startedAt),
  );
  /** The order of the runs shown, to change. */
  private readonly shownOrder = computed((): RunOrder => {
    const { runs, line } = this.state.order();
    const ids = runs.map((run) => run.id);
    return line === undefined ? { ids } : { ids, line };
  });
  /** The id of the run whose context menu is open, or {@link ALL} for all of them. */
  protected readonly picked = signal<string | undefined>(undefined);
  protected readonly ALL = ALL;
  private readonly runMenu = viewChild.required(DropdownMenu);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly myGroupings = inject(MyGroupings);
  private readonly router = inject(Router);

  constructor() {
    void this.myGroupings.load();
  }

  protected setIncludeUnchecked(event: Event): void {
    void this.tweaks.setIncludeUnchecked((event.target as HTMLInputElement).checked);
  }

  /** Adds a run tapped to the chart on top, or takes it off, in developer mode. */
  protected select(id: string): void {
    this.selected.update((selected) => {
      const next = new Set(selected);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  /** Picks the place tapped on a plot along the places, if it's one. */
  protected pickPlaceOn(plot: Plot, x: number): void {
    if (plot.x.places === true) {
      this.pickedPlace.set(Math.round(x));
    }
  }

  /** Opens the context menu of a run long pressed, or of all of them, where it was pressed. */
  protected pick(id: string, at: { readonly x: number; readonly y: number }): void {
    this.picked.set(id);
    this.runMenu().openAt(at);
  }

  /** Opens the replay of the run picked. */
  protected watchPicked(): void {
    void this.router.navigate(['/runs', this.picked(), 'replay']);
  }

  /** Deletes the run picked, once the player confirms. */
  protected async deletePicked(): Promise<void> {
    const id = this.picked();
    if (id !== undefined) {
      await this.state.deleteRun(id);
    }
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
    const { runs, line } = this.state.order();
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
  protected step(id: string, index: number, by: number): void {
    const to = index + by;
    if (to < 0 || to >= this.rows().length) {
      return;
    }
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

  /** Deletes the unchecked runs, once the player confirms. */
  protected deleteUnchecked(): Promise<void> {
    const ids = this.uncheckedRuns().map((run) => run.id);
    return this.state.deleteRuns(
      ids,
      `Delete ${ids.length === 1 ? 'the unchecked run' : `the ${String(ids.length)} unchecked runs`}? Only a backup file can bring ${ids.length === 1 ? 'it' : 'them'} back.`,
      `Deleted ${plural(ids.length, 'unchecked run')}.`,
    );
  }
}

/** The key to the chart of times, on top in developer mode, drawn like its marks. */
const TIMES_KEYS: readonly Key[] = Object.values(TIMES);

/** The key to the chart of times outside developer mode, which shows no runs picked. */
const AGGREGATE_KEYS: readonly Key[] = TIMES_KEYS.filter((key) => key !== TIMES.others);

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
