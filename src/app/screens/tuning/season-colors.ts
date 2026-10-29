import { Component, computed, effect, inject, signal } from '@angular/core';
import { Background } from '../../ui/background';
import { COLOR_SPACE_NAMES, COLOR_SPACES, ColorSpace } from '../../game/color/color-spaces';
import { MatButton } from '@angular/material/button';
import {
  MatCard,
  MatCardContent,
  MatCardHeader,
  MatCardSubtitle,
  MatCardTitle,
} from '@angular/material/card';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatSlider, MatSliderThumb } from '@angular/material/slider';
import { MatPage } from '../../ui/mat-page';
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
  imports: [
    ColorPicker,
    CopyValues,
    MatButton,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardSubtitle,
    MatCardTitle,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatPage,
    MatSlider,
    MatSliderThumb,
    SeasonHeader,
  ],
  template: `
    <app-mat-page heading="Season Colors">
      <button pageAction matButton type="button" [disabled]="!tuned()" (click)="reset()">
        Reset All
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
                [title]="names[season] + ' ' + end.label"
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
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>Blending</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p>Blend colors in</p>
          <button matButton="outlined" type="button" [matMenuTriggerFor]="spaceMenu">
            {{ spaceLabel(colorSpace()) }}
          </button>
          <mat-menu #spaceMenu="matMenu">
            @for (space of colorSpaces; track space) {
              <button mat-menu-item type="button" (click)="blendIn(space)">
                {{ spaceLabel(space) }}{{ space === colorSpace() ? ' ✓' : '' }}
              </button>
            }
          </mat-menu>
          <p>{{ turnText() }}</p>
          <mat-slider min="1" [max]="placesPerSeason" step="1" discrete>
            <input
              matSliderThumb
              aria-label="Season turn"
              [value]="seasonTurn()"
              (valueChange)="turnOver($event)"
            />
          </mat-slider>
        </mat-card-content>
      </mat-card>
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>Place in the year</mat-card-title>
          <mat-card-subtitle>The year runs from 0 to {{ placesPerYear }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <mat-slider
            [min]="-placesPerSeason"
            [max]="placesPerYear + placesPerSeason"
            step="1"
            discrete
          >
            <input
              matSliderThumb
              aria-label="Place in the year"
              [value]="place()"
              (valueChange)="place.set($event)"
            />
          </mat-slider>
        </mat-card-content>
      </mat-card>
      <app-copy-values [values]="copied()" />
    </app-mat-page>
  `,
  styleUrl: './season-colors.css',
})
export class SeasonColors {
  protected readonly seasons = SEASONS;
  protected readonly names = SEASON_NAMES;
  protected readonly ends = ENDS;
  protected readonly placesPerYear = PLACES_PER_YEAR;
  protected readonly placesPerSeason = PLACES_PER_SEASON;
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
    void this.tweaks.setSeasons(this.starts());
  }

  /** A color space's name, saying which is the game's. */
  protected spaceLabel(space: ColorSpace): string {
    return `${this.spaceNames[space]}${space === this.gameSpace ? ' (The Game’s)' : ''}`;
  }

  /** Blends the colors in this color space. */
  protected blendIn(space: ColorSpace): void {
    void this.tweaks.setColorSpace(space);
  }

  protected turnOver(turn: number): void {
    void this.tweaks.setSeasonTurn(turn);
  }

  protected reset(): void {
    this.edited = true;
    this.starts.set(SEASON_STARTS);
    void this.tweaks.setSeasons(undefined);
    void this.tweaks.setColorSpace(undefined);
    void this.tweaks.setSeasonTurn(undefined);
  }
}
