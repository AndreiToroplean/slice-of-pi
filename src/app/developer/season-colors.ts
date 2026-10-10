import { Component, computed, effect, inject, signal } from '@angular/core';
import { Background } from '../background/background';
import { PageHeader } from '../page-header/page-header';
import { SEASON_NAMES, SeasonHeader } from '../season-header/season-header';
import { backgroundsFrom, PLACES_PER_YEAR, Season, seasonAt, SEASONS } from '../seasons/seasons';
import { SEASON_STARTS, SeasonStarts, Tweaks } from './tweaks';

/** Which of a season's colors: the top of the screen, or the bottom. */
const ENDS = [
  { index: 0, label: 'top' },
  { index: 1, label: 'bottom' },
] as const;

/**
 * Developer mode's page to tune the seasons' colors: the top and bottom colors each season starts on, picked with the
 * browser's color picker, and a slider through the year that moves the background exactly as typing digits does.
 */
@Component({
  selector: 'app-season-colors',
  imports: [PageHeader, SeasonHeader],
  host: { class: 'screen' },
  template: `
    <app-page-header title="Season colors" />
    <app-season-header [view]="view()" />
    <div class="seasons">
      @for (season of seasons; track season) {
        <div
          class="season"
          role="group"
          [attr.aria-label]="names[season]"
          [style.--top]="starts()[season][0]"
          [style.--bottom]="starts()[season][1]"
        >
          <span class="name">{{ names[season] }}</span>
          @for (end of ends; track end.index) {
            <input
              type="color"
              [class]="end.label"
              [value]="starts()[season][end.index]"
              [attr.aria-label]="names[season] + ' ' + end.label"
              (input)="pick(season, end.index, $event)"
            />
          }
        </div>
      }
    </div>
    <label class="place">
      Place in the year
      <input
        type="range"
        min="0"
        [max]="placesPerYear"
        step="1"
        [value]="place()"
        (input)="moveTo($event)"
      />
    </label>
    <button type="button" class="candy" [disabled]="!tuned()" (click)="reset()">
      Back to the game's colors
    </button>
  `,
  styleUrl: './season-colors.css',
})
export class SeasonColors {
  protected readonly seasons = SEASONS;
  protected readonly names = SEASON_NAMES;
  protected readonly ends = ENDS;
  protected readonly placesPerYear = PLACES_PER_YEAR;

  private readonly tweaks = inject(Tweaks);
  /** The colors being tuned. */
  protected readonly starts = signal<SeasonStarts>(this.tweaks.values().seasons ?? SEASON_STARTS);
  private edited = false;
  /** The place shown, as if that many digits were typed. */
  protected readonly place = signal(0);

  protected readonly tuned = computed(() =>
    SEASONS.some((season) =>
      this.starts()[season].some((color, k) => color !== SEASON_STARTS[season][k]),
    ),
  );
  protected readonly view = computed(() => seasonAt(this.place(), backgroundsFrom(this.starts())));

  constructor() {
    void this.tweaks.loaded.then(() => {
      if (!this.edited) {
        this.starts.set(this.tweaks.values().seasons ?? SEASON_STARTS);
      }
    });
    // As in the game: the background eases to the colors of the place shown.
    const background = inject(Background);
    effect(() => {
      background.colors.set(this.view().background);
    });
  }

  protected pick(season: Season, end: 0 | 1, event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }
    const color = event.target.value;
    this.edited = true;
    this.starts.update((starts) => ({
      ...starts,
      [season]: end === 0 ? [color, starts[season][1]] : [starts[season][0], color],
    }));
    void this.tweaks.setSeasons(this.tuned() ? this.starts() : undefined);
  }

  protected moveTo(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.place.set(Number(event.target.value));
    }
  }

  protected reset(): void {
    this.edited = true;
    this.starts.set(SEASON_STARTS);
    void this.tweaks.setSeasons(undefined);
  }
}
