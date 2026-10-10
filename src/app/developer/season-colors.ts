import { Component, computed, effect, inject, signal } from '@angular/core';
import { Background } from '../background/background';
import { PageHeader } from '../page-header/page-header';
import { SEASON_NAMES, SeasonHeader } from '../season-header/season-header';
import { backgroundsFrom, PLACES_PER_YEAR, Season, seasonAt, SEASONS } from '../seasons/seasons';
import { ColorPicker } from './color-picker';
import { CopyValues } from './copy-values';
import { SEASON_STARTS, SeasonStarts, seasonsText, Tweaks } from './tweaks';

/** Which of a season's colors: the top of the screen, or the bottom. */
const ENDS = [
  { index: 0, label: 'top' },
  { index: 1, label: 'bottom' },
] as const;

/**
 * Developer mode's page to tune the seasons' colors: the top and bottom colors each season starts on, each selected
 * then tuned in the color picker under them, and a slider through the year that moves the background exactly as
 * typing digits does.
 */
@Component({
  selector: 'app-season-colors',
  imports: [ColorPicker, CopyValues, PageHeader, SeasonHeader],
  host: { class: 'screen' },
  template: `
    <app-page-header title="Season colors">
      <app-copy-values [text]="copyText()" />
    </app-page-header>
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
            <button
              type="button"
              [class]="'swatch ' + end.label"
              [style.background]="starts()[season][end.index]"
              [attr.aria-label]="names[season] + ' ' + end.label"
              [attr.aria-pressed]="isSelected(season, end.index)"
              (click)="selected.set({ season, end: end.index })"
            ></button>
          }
        </div>
      }
    </div>
    <app-color-picker
      [color]="selectedColor()"
      [name]="selectedName()"
      [neighbors]="neighbors()"
      (colorChange)="pick($event)"
    />
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
  /** The color being tuned in the picker: the top of spring at first. */
  protected readonly selected = signal<{ season: Season; end: 0 | 1 }>({
    season: 'spring',
    end: 0,
  });
  protected readonly selectedColor = computed(
    () => this.starts()[this.selected().season][this.selected().end],
  );
  protected readonly selectedName = computed(
    () => `${this.names[this.selected().season]} ${ENDS[this.selected().end].label}`,
  );
  /** The same end of the seasons before and after. */
  protected readonly neighbors = computed((): readonly [string, string] => {
    const { season, end } = this.selected();
    const index = SEASONS.indexOf(season);
    const around = (offset: number): string =>
      this.starts()[SEASONS[(index + offset + SEASONS.length) % SEASONS.length] ?? season][end];
    return [around(-1), around(1)];
  });

  protected readonly tuned = computed(() =>
    SEASONS.some((season) =>
      this.starts()[season].some((color, k) => color !== SEASON_STARTS[season][k]),
    ),
  );
  /** The colors as text, to hand back so they go into the code. */
  protected readonly copyText = computed(() => seasonsText(this.starts()));
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

  protected isSelected(season: Season, end: 0 | 1): boolean {
    return this.selected().season === season && this.selected().end === end;
  }

  /** Sets the color selected. */
  protected pick(color: string): void {
    const { season, end } = this.selected();
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
