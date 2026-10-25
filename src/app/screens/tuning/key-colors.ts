import { Component, computed, inject, signal } from '@angular/core';
import { Background } from '../../ui/background';
import { Page } from '../../ui/page';
import { Palette, PALETTE } from '../../game/layers/place-colors';
import { SEASON_NAMES } from '../play/season-header/season-header';
import { Season, SEASONS } from '../../game/layers/seasons';
import { colorDifference } from '../../game/color/color-math';
import { ColorPicker } from './color-picker';
import { CopyValues } from './copy-values';
import { SEASON_STARTS, Tweaks } from '../../developer-mode/tweaks';

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

/** Pairs closer than this (ΔE 2000) are easy to mix up at a glance. */
export const CLOSE = 15;

/**
 * Developer mode's page to tune the 10 key colors, fitting the screen: every pair of them side by side, outlined where
 * they're easy to mix up, on a season's background. Selecting a key, at the start of its row or anywhere on it, tunes it in the color
 * picker under the grid.
 */
@Component({
  selector: 'app-key-colors',
  imports: [ColorPicker, CopyValues, Page],
  template: `
    <app-page heading="Key Colors">
      <button pageAction type="button" class="frosted pill" [disabled]="!tuned()" (click)="reset()">
        Back to Default Settings
      </button>
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
        @for (row of hexes(); track $index; let r = $index) {
          <button
            type="button"
            class="head tile"
            [style.--place-color]="row"
            [attr.aria-label]="names()[r]"
            [attr.aria-pressed]="r === selected()"
            (click)="selected.set(r)"
          >
            {{ r }}
          </button>
          @for (column of hexes(); track $index; let c = $index) {
            <span
              class="pair"
              aria-hidden="true"
              [class.close]="isClose(row, column)"
              (click)="selected.set(r)"
            >
              <span class="tile" [style.--place-color]="row">{{ r }}</span>
              <span class="tile" [style.--place-color]="column">{{ c }}</span>
            </span>
          }
        }
      </div>
      <app-color-picker
        [color]="hexes()[selected()] ?? '#000000'"
        [name]="names()[selected()] ?? ''"
        [neighbors]="neighbors()"
        (colorChange)="tune($event)"
      />
      <app-copy-values [values]="{ palette: hexes() }" />
    </app-page>
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
  /** The key colors on either side of the one selected, in the palette's order, which goes round. */
  protected readonly neighbors = computed((): readonly [string, string] => {
    const colors = this.hexes();
    const around = (offset: number): string =>
      colors[(this.selected() + offset + colors.length) % colors.length] ?? '#000000';
    return [around(-1), around(1)];
  });
  protected readonly tuned = computed(() => this.hexes().some((color, i) => color !== PALETTE[i]));
  /** The colors as text, to hand back so they go into the code. */
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

  protected isClose(row: string, column: string): boolean {
    return row !== column && colorDifference(row, column) < CLOSE;
  }

  /** Sets the selected key's color. */
  protected tune(color: string): void {
    this.edited = true;
    this.hexes.update((colors) => colors.map((old, i) => (i === this.selected() ? color : old)));
    void this.tweaks.setPalette(this.hexes());
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
