import { Component, computed, effect, inject, signal } from '@angular/core';
import { Background } from '../../ui/background';
import { COLOR_SPACE_NAMES, COLOR_SPACES } from '../../game/color/color-spaces';
import { Page } from '../../ui/page';
import { SEASON_NAMES, SeasonHeader } from '../play/season-header/season-header';
import {
  backgroundsFrom,
  PLACES_PER_SEASON,
  PLACES_PER_YEAR,
  Season,
  seasonAt,
  SEASON_COLOR_SPACE,
  SEASON_TURN,
  SEASONS,
} from '../../game/layers/seasons';
import { ColorPicker } from './color-picker';
import { CopyValues } from './copy-values';
import { SEASON_STARTS, SeasonStarts, Tweaks, TweakValues } from '../../developer-mode/tweaks';

/** Which of a season's colors: the top of the screen, or the bottom. */
const ENDS = [
  { index: 0, label: 'top' },
  { index: 1, label: 'bottom' },
] as const;

/**
 * Developer mode's page to tune the seasons' colors: the top and bottom colors each season starts on, each selected
 * then tuned in the color picker under them, the color space they blend in, how long they take to turn, and a slider through the year, and into
 * the years before and after, that moves the background exactly as typing digits does.
 */
@Component({
  selector: 'app-season-colors',
  imports: [ColorPicker, CopyValues, Page, SeasonHeader],
  template: `
    <app-page title="Season Colors">
      <button pageAction type="button" class="frosted pill" [disabled]="!tuned()" (click)="reset()">
        Back to the Game's Colors
      </button>
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
      <label class="space">
        Blend colors in
        <select class="frosted pill" (change)="blendIn($event)">
          @for (space of colorSpaces; track space) {
            <option [value]="space" [selected]="space === colorSpace()">
              {{ spaceNames[space] }}{{ space === gameSpace ? ' (The Game’s)' : '' }}
            </option>
          }
        </select>
      </label>
      <label class="slider turn">
        {{ turnText() }}
        <input
          type="range"
          min="1"
          [max]="placesPerSeason"
          step="1"
          [value]="seasonTurn()"
          (input)="turnOver($event)"
        />
      </label>
      <label class="slider place">
        Place in the year
        <input
          type="range"
          [min]="-placesPerSeason"
          [max]="placesPerYear + placesPerSeason"
          step="1"
          [value]="place()"
          (input)="moveTo($event)"
        />
        <span class="marks" aria-hidden="true">
          @for (mark of yearEnds; track mark.place) {
            <span [style.--at]="mark.at">{{ mark.place }}</span>
          }
        </span>
      </label>
      <app-copy-values [values]="copied()" />
    </app-page>
  `,
  styleUrl: './season-colors.css',
})
export class SeasonColors {
  protected readonly seasons = SEASONS;
  protected readonly names = SEASON_NAMES;
  protected readonly ends = ENDS;
  protected readonly placesPerYear = PLACES_PER_YEAR;
  protected readonly placesPerSeason = PLACES_PER_SEASON;
  /** Marks under the place slider where the year starts and ends, and how far along the slider they are. */
  protected readonly yearEnds = [0, PLACES_PER_YEAR].map((place) => ({
    place,
    at: (place + PLACES_PER_SEASON) / (PLACES_PER_YEAR + 2 * PLACES_PER_SEASON),
  }));
  protected readonly colorSpaces = COLOR_SPACES;
  protected readonly spaceNames = COLOR_SPACE_NAMES;
  protected readonly gameSpace = SEASON_COLOR_SPACE;

  private readonly tweaks = inject(Tweaks);
  /** The colors being tuned. */
  protected readonly starts = signal<SeasonStarts>(this.tweaks.values().seasons ?? SEASON_STARTS);
  private edited = false;
  /**
   * The place shown, as if that many digits were typed: a whole year, marked at its start and its end, and a season
   * on either side, to look at the turns of the year too.
   */
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

  /** The color space the colors blend in. */
  protected readonly colorSpace = this.tweaks.colorSpace;

  private readonly colorsTuned = computed(() =>
    SEASONS.some((season) =>
      this.starts()[season].some((color, k) => color !== SEASON_STARTS[season][k]),
    ),
  );
  /** How many places a season takes to turn into the next. */
  protected readonly seasonTurn = this.tweaks.seasonTurn;
  protected readonly turnText = computed(() => {
    const turn = this.seasonTurn();
    return turn === 1
      ? 'Each season turns into the next at once'
      : turn === PLACES_PER_SEASON
        ? 'Each season turns into the next all season long'
        : `Each season turns into the next over its last ${String(turn)} digits`;
  });

  protected readonly tuned = computed(
    () =>
      this.colorsTuned() ||
      this.colorSpace() !== SEASON_COLOR_SPACE ||
      this.seasonTurn() !== SEASON_TURN,
  );
  /** The colors, and how they blend and turn, tuned or not, to hand back so they go into the code. */
  protected readonly copied = computed((): TweakValues => ({
    seasons: this.starts(),
    colorSpace: this.colorSpace(),
    seasonTurn: this.seasonTurn(),
  }));
  protected readonly view = computed(() =>
    seasonAt(this.place(), backgroundsFrom(this.starts()), this.colorSpace(), this.seasonTurn()),
  );

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
    void this.tweaks.setSeasons(this.colorsTuned() ? this.starts() : undefined);
  }

  /** Blends the colors in the color space selected. */
  protected blendIn(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      const { value } = event.target;
      const space = COLOR_SPACES.find((name) => name === value) ?? SEASON_COLOR_SPACE;
      void this.tweaks.setColorSpace(space === SEASON_COLOR_SPACE ? undefined : space);
    }
  }

  protected turnOver(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      const turn = Number(event.target.value);
      void this.tweaks.setSeasonTurn(turn === SEASON_TURN ? undefined : turn);
    }
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
    void this.tweaks.setColorSpace(undefined);
    void this.tweaks.setSeasonTurn(undefined);
  }
}
