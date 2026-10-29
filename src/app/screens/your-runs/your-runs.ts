import { CdkScrollable } from '@angular/cdk/scrolling';
import { CdkMenuItem } from '@angular/cdk/menu';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Dropdown } from '../../ui/menu';
import { Candy } from '../../ui/candy';
import { Page } from '../../ui/page';
import { GroupList } from './group-list';
import { RunCard } from './run-card';
import { HereLine } from './here-line';
import { RunsState } from './runs-state';
import { SummaryCard } from './summary-card';
import { TIMES, TimesView } from './times-view';
import { Key, Range } from './views/plot';

/**
 * The player's runs, opened from the main menu, on one screen: a card on top with the chart of them all and their
 * groups, and under it a card for each run, scrolling, in the order the game takes them, and the line it plays from
 * among them, if any. A long press on a run opens its context menu, to watch its replay or delete it, and in developer
 * mode to play from after it. Its layout is the same in developer mode, the tweaks applying to it as to the whole game:
 * Model Tuning is where they're tuned.
 */
@Component({
  selector: 'app-your-runs',
  imports: [
    CdkScrollable,
    Candy,
    CdkMenuItem,
    Dropdown,
    GroupList,
    HereLine,
    Page,
    RunCard,
    SummaryCard,
    TimesView,
  ],
  providers: [RunsState],
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
      @if (state.charts().length > 0) {
        <app-summary-card>
          <app-times-view
            [title]="state.aggregateTitle()"
            [aggregate]="state.aggregateChart()"
            [places]="state.places()"
            [top]="state.top()"
            [keys]="KEYS"
            [(zoom)]="placeZoom"
          >
            <app-group-list [groups]="state.groups()" />
          </app-times-view>
        </app-summary-card>
      }
      <!-- The runs, scrolling under the card: the only part of the page that scrolls. -->
      <section class="runs" cdkScrollable>
        <p class="message" role="status">{{ state.message() }}</p>
        @for (row of state.rows(); track row.id) {
          @if (row.chart; as chart) {
            <app-run-card
              [chart]="chart"
              [places]="state.places()"
              [top]="state.top()"
              [window]="placeZoom()"
              [menu]="runMenu"
            />
          } @else {
            <app-here-line />
          }
        } @empty {
          @if (state.loaded()) {
            <p>None yet: each game you play shows up here.</p>
          }
        }
      </section>
      <!-- A run's context menu, opened by its ⋮ or a long press on it; in developer mode, to play from it too. -->
      <ng-template #runMenu let-id>
        <div appDropdown aria-label="Run">
          <button type="button" cdkMenuItem (cdkMenuItemTriggered)="watch(id)">Watch Replay</button>
          <button type="button" cdkMenuItem (cdkMenuItemTriggered)="void state.deleteRun(id)">
            Delete Run
          </button>
          @if (developerMode()) {
            <hr />
            <button type="button" cdkMenuItem (cdkMenuItemTriggered)="state.playFrom(id)">
              Play from Here
            </button>
          }
        </div>
      </ng-template>
    </app-page>
  `,
  styleUrl: './your-runs.css',
})
export class YourRuns {
  protected readonly state = inject(RunsState);
  /**
   * The window of the places the charts show, zoomed into on the chart of all runs: the charts of the runs follow it.
   * All of them if undefined.
   */
  protected readonly placeZoom = signal<Range | undefined>(undefined);
  protected readonly KEYS = KEYS;
  /** Playing from a run is a tweak, for developer mode only. */
  protected readonly developerMode = inject(DeveloperMode).enabled;
  private readonly router = inject(Router);

  /** Opens the replay of a run. */
  protected watch(id: string): void {
    void this.router.navigate(['/runs', id, 'replay']);
  }
}

/** The key to the chart of all runs: what the break model makes of it, but how confident it is, which is for tuning it. */
const KEYS: readonly Key[] = [TIMES.time, TIMES.baseline, TIMES.breaks];
