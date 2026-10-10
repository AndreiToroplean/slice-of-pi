import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Background } from '../background/background';
import { PageHeader } from '../page-header/page-header';
import { Palette, PALETTE } from '../place-colors/place-colors';
import { SEASON_NAMES } from '../season-header/season-header';
import { Season, SEASONS } from '../seasons/seasons';
import { colorDifference } from './color-math';
import { ColorPicker } from './color-picker';
import { CopyValues } from './copy-values';
import { paletteText, SEASON_STARTS, Tweaks } from './tweaks';

/** The palette's colors, by name, in key order. */
export const COLOR_NAMES = [
  'red',
  'orange',
  'yellow',
  'lime',
  'green',
  'teal',
  'blue',
  'violet',
  'purple',
  'pink',
] as const;

/** The digits' color, on every key color. */
export const DIGIT_COLOR = '#ffffff';

/** Pairs closer than this (ΔE 2000) are easy to mix up at a glance. */
export const CLOSE = 15;

/** A color of the grid: a key color, by its index, or the digits' white. */
interface GridColor {
  readonly index: number | undefined;
  readonly color: string;
  readonly label: string;
}

/**
 * Developer mode's page to tune the 10 key colors: every pair of them side by side, and with the digits' white,
 * outlined where they're easy to mix up, on a season's background. Selecting a key color tunes it in the color picker
 * under the grid.
 */
@Component({
  selector: 'app-key-colors',
  imports: [ColorPicker, CopyValues, NgTemplateOutlet, PageHeader],
  host: { class: 'screen' },
  template: `
    <app-page-header title="Key colors">
      <app-copy-values [text]="copyText()" />
    </app-page-header>
    <div class="seasons" role="radiogroup" aria-label="Background">
      @for (season of seasons; track season) {
        <button
          type="button"
          class="frosted"
          role="radio"
          [attr.aria-checked]="season === background()"
          (click)="showBackground(season)"
        >
          {{ seasonNames[season] }}
        </button>
      }
    </div>
    <div class="grid">
      <span></span>
      @for (column of gridColors(); track column.label) {
        <ng-container *ngTemplateOutlet="header; context: { $implicit: column }"></ng-container>
      }
      @for (row of gridColors(); track row.label) {
        <ng-container *ngTemplateOutlet="header; context: { $implicit: row }"></ng-container>
        @for (column of gridColors(); track column.label) {
          <span class="pair" aria-hidden="true" [class.close]="isClose(row, column)">
            <span class="tile" [style.--place-color]="row.color">{{ row.index }}</span>
            <span class="tile" [style.--place-color]="column.color">{{ column.index }}</span>
          </span>
        }
      }
    </div>
    <ng-template #header let-color>
      @if (color.index === undefined) {
        <span class="head tile white" title="The digits' white"></span>
      } @else {
        <button
          type="button"
          class="head tile"
          [style.--place-color]="color.color"
          [attr.aria-label]="color.label"
          [attr.aria-pressed]="color.index === selected()"
          (click)="selected.set(color.index)"
        >
          {{ color.index }}
        </button>
      }
    </ng-template>
    <app-color-picker
      [color]="hexes()[selected()] ?? '#000000'"
      [name]="names()[selected()] ?? ''"
      [neighbors]="neighbors()"
      (colorChange)="tune($event)"
    />
    <button type="button" class="candy" [disabled]="!tuned()" (click)="reset()">
      Back to the game's colors
    </button>
  `,
  styleUrl: './key-colors.css',
})
export class KeyColors {
  protected readonly seasons = SEASONS;
  protected readonly seasonNames = SEASON_NAMES;

  private readonly tweaks = inject(Tweaks);
  private readonly backgroundColors = inject(Background).colors;
  /** The colors being tuned. */
  protected readonly hexes = signal<Palette>(this.tweaks.values().palette ?? PALETTE);
  private edited = false;
  /** The key whose color is in the picker. */
  protected readonly selected = signal(0);

  protected readonly names = computed(() =>
    COLOR_NAMES.map((name, i) => `Key ${String(i)}, ${name}`),
  );
  protected readonly gridColors = computed((): readonly GridColor[] => [
    ...this.hexes().map((color, index) => ({ index, color, label: this.names()[index] ?? '' })),
    { index: undefined, color: DIGIT_COLOR, label: 'The digits’ white' },
  ]);
  /** The key colors on either side of the one selected, in the palette's order, which goes round. */
  protected readonly neighbors = computed((): readonly [string, string] => {
    const colors = this.hexes();
    const around = (offset: number): string =>
      colors[(this.selected() + offset + colors.length) % colors.length] ?? DIGIT_COLOR;
    return [around(-1), around(1)];
  });
  protected readonly tuned = computed(() => this.hexes().some((color, i) => color !== PALETTE[i]));
  /** The colors as text, to hand back so they go into the code. */
  protected readonly copyText = computed(() => paletteText(this.hexes()));
  /** The season whose background the grid is shown on. */
  protected readonly background = signal<Season>('spring');

  constructor() {
    void this.tweaks.loaded.then(() => {
      if (!this.edited) {
        this.hexes.set(this.tweaks.values().palette ?? PALETTE);
      }
    });
    this.showBackground('spring');
  }

  protected isClose(row: GridColor, column: GridColor): boolean {
    return row.color !== column.color && colorDifference(row.color, column.color) < CLOSE;
  }

  /** Sets the selected key's color. */
  protected tune(color: string): void {
    this.edited = true;
    this.hexes.update((colors) => colors.map((old, i) => (i === this.selected() ? color : old)));
    void this.tweaks.setPalette(this.tuned() ? this.hexes() : undefined);
  }

  protected reset(): void {
    this.edited = true;
    this.hexes.set(PALETTE);
    void this.tweaks.setPalette(undefined);
  }

  /** Shows a season's starting background, as tuned, behind the page. */
  protected showBackground(season: Season): void {
    this.background.set(season);
    this.backgroundColors.set((this.tweaks.values().seasons ?? SEASON_STARTS)[season]);
  }
}
