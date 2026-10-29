import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
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
} from '@angular/core';
import { Carousel } from '../../ui/carousel';
import { Router } from '@angular/router';
import { Tweaks } from '../../developer-mode/tweaks';
import { Page } from '../../ui/page';
import { moveRun } from '../../player-data/run';
import { FitToGroupingsDialog } from './fit-to-groupings-dialog';
import { GroupingSettingsPanel } from './grouping-settings-panel';
import { CdkMenuItem, CdkMenuItemCheckbox } from '@angular/cdk/menu';
import { ContextMenu, Dropdown } from '../../ui/menu';
import { GroupPerspective } from './group-perspective';
import { MyGroupings } from './my-groupings';
import { PlacePerspective } from './place-perspective';
import { groupViews } from '../your-runs/views/group-views';
import { modelViews } from '../your-runs/views/model-views';
import { Key, Plot, Range } from '../your-runs/views/plot';
import { PlotView } from '../your-runs/views/plot-view';
import { plural } from '../../ui/plural';
import { Candy } from '../../ui/candy';
import { Segment, Segmented } from '../../ui/segmented';
import { RunCard } from '../your-runs/run-card';
import { HereLine } from '../your-runs/here-line';
import { MoreButton } from '../../ui/more-button';
import { dateAndTime, RunsState, WITH_UNCHECKED } from '../your-runs/runs-state';
import { SummaryCard } from '../your-runs/summary-card';
import { TIMES, TimesView } from '../your-runs/times-view';

/**
 * Developer mode's page to tune the break model, from the main menu's developer pages: the player's runs, every one of
 * them, unchecked ones marked, under a card stepping through what the break model makes of them, in three perspectives:
 * along the places, over the runs; across the runs, at the place picked by tapping a chart of the first; or along the
 * digits of a group. Tapping a run adds it to the card, and its handle moves it to another place among the runs, in the
 * order the game takes them. Tabs beside the runs hold sliders for the hyperparameters of the break model, so they can
 * be tuned in view of the card, and never moved by scrolling, and a dialog fits them to the player's own groups. A long
 * press on a run opens its context menu, to watch its replay or play from after it, as if the runs after it had never
 * been played, until undone; one on all runs, to play from before them all, as if none had been played.
 */
@Component({
  selector: 'app-model-tuning',
  imports: [
    Candy,
    Segmented,
    Carousel,
    CdkDrag,
    CdkDropList,
    CdkScrollable,
    FitToGroupingsDialog,
    GroupingSettingsPanel,
    CdkMenuItem,
    CdkMenuItemCheckbox,
    ContextMenu,
    MoreButton,
    Page,
    GroupPerspective,
    PlacePerspective,
    PlotView,
    RunCard,
    Dropdown,
    HereLine,
    SummaryCard,
    TimesView,
  ],
  providers: [RunsState, { provide: WITH_UNCHECKED, useValue: signal(true) }],
  template: `
    <app-page heading="Model Tuning">
      <button pageAction type="button" appCandy="danger" [disabled]="!tuned()" (click)="reset()">
        Reset All
      </button>
      @if (charts().length > 0) {
        <app-summary-card>
          <!--
            The steps of the break model, one after the other: along the places, over the runs, or at the place picked
            on them, across the runs, or along the digits of a group.
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
        </app-summary-card>
      }
      <app-grouping-settings-panel #panel [menu]="panelMenu" (told)="state.message.set($event)">
        <!-- The runs, scrolling under the card: the only part of the page that scrolls. -->
        <section class="runs" cdkScrollable>
          <p class="message" role="status">{{ state.message() }}</p>
          @if (charts().length === 0) {
            @if (state.loaded()) {
              <p>None yet: each game you play shows up here.</p>
            }
          } @else {
            <!-- The chart of all runs can be left out of the card, and runs added to it. -->
            <div class="panel aggregate" [class.selected]="aggregateShown()">
              <button
                type="button"
                [attr.aria-pressed]="aggregateShown()"
                [appContextMenu]="runMenu"
                [appContextMenuData]="{ $implicit: ALL }"
                (click)="aggregateShown.set(!aggregateShown())"
              >
                <span class="title">{{ state.aggregateTitle() }}</span>
                <span class="meta">{{ plural(state.counted().length, 'run') }}</span>
              </button>
              <button
                class="more"
                title="More for all runs"
                [appMore]="runMenu"
                [appMoreData]="{ $implicit: ALL }"
              ></button>
            </div>
            <!-- The runs can be dragged into another order, across the line too. -->
            <div
              class="list"
              cdkDropList
              cdkDropListLockAxis="y"
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
                    [menu]="runMenu"
                    [selectable]="true"
                    [selected]="selected().has(chart.id)"
                    [reorderable]="true"
                    (toggled)="select(chart.id)"
                    (moved)="step(chart.id, index, $event)"
                  />
                } @else {
                  <app-here-line cdkDrag cdkDragDisabled />
                }
              }
            </div>
          }
        </section>
        <button
          modelAction
          type="button"
          appCandy
          aria-haspopup="dialog"
          (click)="void fitDialog.open()"
        >
          Fit to My Groupings
        </button>
      </app-grouping-settings-panel>
      <app-fit-to-groupings-dialog #fitDialog [runs]="state.countedTimes()" />
      <ng-template #panelMenu>
        <div appDropdown aria-label="More">
          <button type="button" cdkMenuItem (cdkMenuItemTriggered)="void panel.copy()">
            Copy Hyperparameter Values
          </button>
          <hr />
          <button
            type="button"
            cdkMenuItem
            [cdkMenuItemDisabled]="chronological()"
            (cdkMenuItemTriggered)="reorderChronologically()"
          >
            Reorder Runs Chronologically
          </button>
          <hr />
          <button
            type="button"
            cdkMenuItemCheckbox
            [cdkMenuItemChecked]="includeUnchecked()"
            (cdkMenuItemTriggered)="setIncludeUnchecked(!includeUnchecked())"
          >
            Count Unchecked Runs
          </button>
        </div>
      </ng-template>
      <!-- A run's context menu, opened by its ⋮ or a long press on it, or on all runs to play from before them. -->
      <ng-template #runMenu let-id>
        <div appDropdown aria-label="Run">
          @if (id !== ALL) {
            <button type="button" cdkMenuItem (cdkMenuItemTriggered)="watch(id)">
              Watch Replay
            </button>
            <hr />
          }
          <button type="button" cdkMenuItem (cdkMenuItemTriggered)="playFrom(id)">
            Play from Here
          </button>
        </div>
      </ng-template>
    </app-page>
  `,
  styleUrl: './model-tuning.css',
})
export class ModelTuning {
  protected readonly state = inject(RunsState);
  private readonly tweaks = inject(Tweaks);
  protected readonly includeUnchecked = this.tweaks.includeUnchecked;
  /** Whether the hyperparameters of the break model picked are tuned. */
  protected readonly tuned = computed(
    () => this.tweaks.values().grouping?.[this.tweaks.breakModelKind().id] !== undefined,
  );
  /** What the break model makes of the runs step by step, if it can show that. */
  private readonly steps = computed(() =>
    this.tweaks.breakModelKind().steps?.(this.tweaks.grouping(), this.state.countedTimes()),
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
  /** Whether the chart on top shows all the runs, and which runs it shows besides. */
  protected readonly aggregateShown = signal(true);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly selectedTimes = computed(() =>
    this.charts()
      .filter((chart) => this.selected().has(chart.id))
      .map((chart) => chart.times),
  );
  /** Which perspective on the break model the card on top shows. */
  protected readonly perspective = signal<Perspective>('run');
  protected readonly PERSPECTIVES = PERSPECTIVES;
  protected readonly TIMES_KEYS = TIMES_KEYS;
  /** The runs picked, by their index among the runs counted, as the steps have them. */
  protected readonly pickedRuns = computed(() =>
    this.state.counted().flatMap((run, k) => (this.selected().has(run.id) ? [k] : [])),
  );
  /** What each run counted is called, as the steps have them. */
  protected readonly titles = computed(() =>
    this.state.counted().map((run) => dateAndTime.format(run.startedAt)),
  );
  /**
   * The place the place perspective shows, and that the plots along the places mark: the
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
  /** The views along the digits of a group, the player's own groups among them if they're π. */
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
  /** The steps of the break model after the times, for all the runs and those picked. */
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
    const count = this.selectedTimes().length;
    const runs = count === 0 ? '' : plural(count, 'run');
    return this.aggregateShown() ? [aggregate, runs].filter(Boolean).join(' and ') : runs;
  });

  protected readonly rows = this.state.rows;
  /** Whether the runs are shown in the order they were played in. */
  protected readonly chronological = computed(() =>
    this.state
      .order()
      .runs.every((run, i, runs) => i === 0 || (runs[i - 1]?.startedAt ?? 0) <= run.startedAt),
  );
  private readonly shownOrder = this.state.shownOrder;
  protected readonly ALL = ALL;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly myGroupings = inject(MyGroupings);
  private readonly router = inject(Router);

  constructor() {
    void this.myGroupings.load();
  }

  /** Brings back the game's values of the hyperparameters of the break model picked. */
  protected reset(): void {
    void this.tweaks.setGrouping(undefined);
  }

  protected setIncludeUnchecked(include: boolean): void {
    void this.tweaks.setIncludeUnchecked(include);
  }

  /** Adds a run tapped to the card, or takes it off. */
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

  /** Opens the replay of a run. */
  protected watch(id: string): void {
    void this.router.navigate(['/runs', id, 'replay']);
  }

  /**
   * Plays from just after a run, as if only the runs up to it had been played, or from before all of them ({@link ALL}),
   * keeping the order shown.
   */
  protected playFrom(id: string): void {
    this.state.playFrom(id === ALL ? undefined : id);
  }

  /** Puts the runs back in the order they were played in, the line staying where it is, under as many runs. */
  protected reorderChronologically(): void {
    const { runs, line } = this.state.order();
    const ids = [...runs].sort((a, b) => a.startedAt - b.startedAt).map((run) => run.id);
    void this.tweaks.setRunOrder(line === undefined ? undefined : { ids, line });
  }

  /** Moves a run dropped somewhere else among the runs and the line. */
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
}

/** The key to the chart of times, drawn like its marks. */
const TIMES_KEYS: readonly Key[] = Object.values(TIMES);

/** What the context menu is given when it's for all runs rather than one: no run's id is empty. */
const ALL = '';

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
