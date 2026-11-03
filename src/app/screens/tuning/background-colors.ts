import { Component, computed, effect, inject, signal } from '@angular/core';
import { Background } from '../../ui/background';
import { COLOR_SPACE_NAMES, COLOR_SPACES, ColorSpace } from '../../game/color/color-spaces';
import { CdkMenuItemRadio } from '@angular/cdk/menu';
import { Candy } from '../../ui/candy';
import { Dropdown, MenuTrigger } from '../../ui/menu';
import { Page } from '../../ui/page';
import { Slider } from '../../ui/slider';
import { SEASON_NAMES, SeasonHeader } from '../play/season-header/season-header';
import { TWILIGHT } from '../menu/menu-look';
import {
  BackgroundColors as Gradient,
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

/** What a color is of: a season, or the main menu. */
type Owner = Season | 'menu';

/**
 * Developer mode's page to tune the background's colors: the top and bottom colors each season starts on, and apart
 * from them, the main menu's, each selected then tuned in the color picker under them. Selecting a season's color moves
 * to where the season starts; selecting one of the menu's shows the menu's colors in the background. Under them, the
 * color space they blend in, how long they take to turn, and a slider through the year, and into the years before and
 * after, that moves the background exactly as typing digits does.
 */
@Component({
  selector: 'app-background-colors',
  imports: [
    Slider,
    Candy,
    CdkMenuItemRadio,
    ColorPicker,
    CopyValues,
    Dropdown,
    MenuTrigger,
    Page,
    SeasonHeader,
  ],
  template: `
    <app-page heading="Background Colors">
      <button pageAction type="button" appCandy="danger" [disabled]="!tuned()" (click)="reset()">
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
                (click)="select(season, end.index)"
              ></button>
            }
          </div>
        }
        <span class="divider" aria-hidden="true"></span>
        <div
          class="season"
          role="group"
          aria-label="Main menu"
          [style.--top]="twilight()[0]"
          [style.--bottom]="twilight()[1]"
        >
          <span class="name">Menu</span>
          @for (end of ends; track end.index) {
            <button
              type="button"
              [class]="'swatch ' + end.label"
              [style.background]="twilight()[end.index]"
              [title]="'Main menu ' + end.label"
              [attr.aria-pressed]="isSelected('menu', end.index)"
              (click)="selected.set({ season: 'menu', end: end.index })"
            ></button>
          }
        </div>
      </div>
      <app-color-picker
        [color]="selectedColor()"
        [name]="selectedName()"
        [neighbors]="neighbors()"
        [defaultColor]="defaultColor()"
        (colorChange)="pick($event)"
      />
      <div class="space">
        <span id="space-label">Blend colors in</span>
        <button
          type="button"
          class="frosted pill picker"
          aria-labelledby="space-label space-name"
          [appMenuTrigger]="spaceMenu"
        >
          <span id="space-name">{{ spaceLabel(colorSpace()) }}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <ng-template #spaceMenu>
          <div appDropdown aria-label="Blend colors in">
            @for (space of colorSpaces; track space) {
              <button
                type="button"
                cdkMenuItemRadio
                [cdkMenuItemChecked]="space === colorSpace()"
                (cdkMenuItemTriggered)="blendIn(space)"
              >
                {{ spaceLabel(space) }}
              </button>
            }
          </div>
        </ng-template>
      </div>
      <app-slider
        class="turn"
        label="Season Turn"
        [value]="seasonTurn()"
        [min]="1"
        [max]="placesPerSeason"
        [valueText]="turnText()"
        [defaultValue]="defaultTurn"
        (changed)="turnOver($event)"
      />
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
  styleUrl: './background-colors.css',
})
export class BackgroundColors {
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
  /** The main menu's colors being tuned. */
  protected readonly twilight = signal<Gradient>(this.tweaks.values().twilight ?? TWILIGHT);
  private edited = false;
  /**
   * The place shown, as if that many digits were typed: a whole year, marked at its start and its end, and a season
   * on either side, to look at the turns of the year too.
   */
  protected readonly place = signal(0);
  /** The color being tuned in the picker: the top of spring at first. */
  protected readonly selected = signal<{ season: Owner; end: 0 | 1 }>({
    season: 'spring',
    end: 0,
  });
  protected readonly selectedColor = computed(
    () => this.colorsOf(this.selected().season)[this.selected().end],
  );
  protected readonly selectedName = computed(() => {
    const { season, end } = this.selected();
    return `${season === 'menu' ? 'Main menu' : this.names[season]} ${ENDS[end].label}`;
  });
  /** The game's own color for the one selected. */
  protected readonly defaultColor = computed(() => {
    const { season, end } = this.selected();
    return (season === 'menu' ? TWILIGHT : SEASON_STARTS[season])[end];
  });
  /** The same end of the seasons before and after; none for the main menu's. */
  protected readonly neighbors = computed((): readonly [string, string] | undefined => {
    const { season, end } = this.selected();
    if (season === 'menu') {
      return undefined;
    }
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
  protected readonly defaultTurn = SEASON_TURN;
  /** How each season turns into the next: at once, all season long, or over its last digits. */
  protected readonly turnText = computed(() => {
    const turn = this.seasonTurn();
    return turn === 1
      ? 'At once'
      : turn === PLACES_PER_SEASON
        ? 'All season'
        : `Last ${String(turn)} digits`;
  });

  protected readonly tuned = computed(
    () =>
      this.colorsTuned() ||
      this.twilight().some((color, k) => color !== TWILIGHT[k]) ||
      this.colorSpace() !== SEASON_COLOR_SPACE ||
      this.seasonTurn() !== SEASON_TURN,
  );
  /** The colors, and how they blend and turn, tuned or not, to hand back so they go into the code. */
  protected readonly copied = computed((): TweakValues => ({
    seasons: this.starts(),
    twilight: this.twilight(),
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
        this.twilight.set(this.tweaks.values().twilight ?? TWILIGHT);
      }
    });
    // As in the game: the background eases to the colors of the place shown, or the main menu's, while one of them is
    // selected.
    const background = inject(Background);
    effect(() => {
      background.colors.set(
        this.selected().season === 'menu' ? this.twilight() : this.view().background,
      );
    });
  }

  protected isSelected(season: Owner, end: 0 | 1): boolean {
    return this.selected().season === season && this.selected().end === end;
  }

  /**
   * Selects a season's color, moving to where the season starts, at the colors tuned, as the season before has turned
   * into it.
   */
  protected select(season: Season, end: 0 | 1): void {
    this.selected.set({ season, end });
    this.place.set(SEASONS.indexOf(season) * PLACES_PER_SEASON);
  }

  /** The colors of a season, or of the main menu, top then bottom. */
  private colorsOf(owner: Owner): Gradient {
    return owner === 'menu' ? this.twilight() : this.starts()[owner];
  }

  /** Sets the color selected. */
  protected pick(color: string): void {
    const { season, end } = this.selected();
    this.edited = true;
    if (season === 'menu') {
      this.twilight.update(([top, bottom]) => (end === 0 ? [color, bottom] : [top, color]));
      void this.tweaks.setTwilight(this.twilight());
      return;
    }
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

  protected moveTo(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.place.set(Number(event.target.value));
    }
  }

  protected reset(): void {
    this.edited = true;
    this.starts.set(SEASON_STARTS);
    this.twilight.set(TWILIGHT);
    void this.tweaks.setSeasons(undefined);
    void this.tweaks.setTwilight(undefined);
    void this.tweaks.setColorSpace(undefined);
    void this.tweaks.setSeasonTurn(undefined);
  }
}
