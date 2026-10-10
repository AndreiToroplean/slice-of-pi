import { Component, computed, inject, signal } from '@angular/core';
import { Background } from '../background/background';
import { PageHeader } from '../page-header/page-header';
import { PALETTE, placeColors } from '../place-colors/place-colors';
import { SEASON_NAMES } from '../season-header/season-header';
import { Season, SEASONS } from '../seasons/seasons';
import { closestPairs, contrastWithWhite, hexToOklch, Oklch, oklchToHex } from './color-math';
import { SEASON_STARTS, Tweaks } from './tweaks';

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

/** The first 100 decimals of π. */
export const DECIMALS =
  '1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679';

/** Pairs closer than this are easy to mix up at a glance. */
export const CLOSE = 15;
/** Pairs closer than this look almost the same. */
const ALMOST_THE_SAME = 10;

/** The contrast white digits need on a color to read well; the yellow is allowed less. */
export function contrastNeeded(index: number): number {
  return index === 2 ? 1.75 : 3;
}

/** The sliders of each color, in OKLCH. */
const SLIDERS = [
  { label: 'Lightness', min: 0.3, max: 0.9, step: 0.005 },
  { label: 'Colorfulness', min: 0, max: 0.32, step: 0.002 },
  { label: 'Hue', min: 0, max: 360, step: 1 },
] as const;

/**
 * Developer mode's page to tune the 10 key colors: each color's lightness, colorfulness and hue, with how well white
 * digits read on it and its nearest color, the closest pairs, every pair side by side and the first 100 decimals, on
 * a season's background.
 */
@Component({
  selector: 'app-key-colors',
  imports: [PageHeader],
  host: { class: 'screen' },
  template: `
    <app-page-header title="Key colors" />
    <section class="panel" aria-labelledby="closest-title">
      <h2 id="closest-title">Closest pairs</h2>
      <p>
        How different two colors look (ΔE 2000): under 15 they're easy to mix up at a glance, under
        10 they look almost the same.
      </p>
      @for (pair of closest(); track $index) {
        <div class="pair">
          <span class="word" aria-hidden="true">
            <span class="tile" [style.--place-color]="hexes()[pair.first]">{{ pair.first }}</span>
            <span class="tile" [style.--place-color]="hexes()[pair.second]">{{ pair.second }}</span>
          </span>
          <span class="verdict">
            {{ names[pair.first] }} / {{ names[pair.second] }} · {{ pair.difference.toFixed(1)
            }}{{ verdict(pair.difference) }}
          </span>
          <span class="bar" aria-hidden="true">
            <span [style.width.%]="Math.min(100, (pair.difference / 40) * 100)"></span>
          </span>
        </div>
      }
    </section>
    <section class="panel" aria-labelledby="each-title">
      <h2 id="each-title">Each color</h2>
      <p>
        Lightness, colorfulness and hue, in a color space where equal steps look like equal changes.
        White digits read well on a contrast of 3 or more; the yellow is allowed less.
      </p>
      @for (color of colors(); track color.index) {
        <div class="color">
          <span class="tile swatch" aria-hidden="true" [style.--place-color]="color.hex">{{
            color.index
          }}</span>
          <div class="sliders">
            @for (slider of sliders; track slider.label; let k = $index) {
              <label>
                {{ slider.label }}
                <input
                  type="range"
                  [min]="slider.min"
                  [max]="slider.max"
                  [step]="slider.step"
                  [value]="color.oklch[k]"
                  [attr.aria-label]="names[color.index] + ' ' + slider.label.toLowerCase()"
                  (input)="tune(color.index, k, $event)"
                />
              </label>
            }
          </div>
          <p class="meta">
            <span class="hex">{{ color.hex }}</span
            >&ngsp;<span>{{ names[color.index] }}</span
            >&ngsp;<span [class.bad]="color.contrast < color.contrastNeeded"
              >white digits {{ color.contrast.toFixed(1) }}:1</span
            >&ngsp;<span [class.bad]="color.nearest.difference < close"
              >nearest: {{ color.nearest.index }} {{ names[color.nearest.index] }}, ΔE
              {{ color.nearest.difference.toFixed(1) }}</span
            >
          </p>
        </div>
      }
      <button type="button" class="candy" [disabled]="!tuned()" (click)="reset()">
        Back to the game's colors
      </button>
    </section>
    <section class="on-background" aria-labelledby="pairs-title">
      <h2 id="pairs-title">Every pair</h2>
      <p>The first tile's color by row, the second's by column. Pairs under 15 are outlined.</p>
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
      <div class="pairs" aria-hidden="true">
        <span></span>
        @for (color of colors(); track color.index) {
          <span class="head">{{ color.index }}</span>
        }
        @for (row of colors(); track row.index) {
          <span class="head">{{ row.index }}</span>
          @for (column of colors(); track column.index) {
            <span class="word" [class.close]="isClose(row.index, column.index)">
              <span class="tile" [style.--place-color]="row.hex">{{ row.index }}</span>
              <span class="tile" [style.--place-color]="column.hex">{{ column.index }}</span>
            </span>
          }
        }
      </div>
    </section>
    <section class="on-background" aria-labelledby="sample-title">
      <h2 id="sample-title">The first 100 decimals</h2>
      <div class="words" aria-hidden="true">
        <span class="word lead">
          <span class="tile">π</span><span class="tile">=</span><span class="tile">3</span
          ><span class="tile">.</span>
        </span>
        @for (word of sample(); track $index) {
          <span class="word">
            @for (place of word; track $index) {
              <span class="tile" [style.--place-color]="place.color">{{ place.digit }}</span>
            }
          </span>
        }
      </div>
    </section>
  `,
  styleUrl: './key-colors.css',
})
export class KeyColors {
  protected readonly names = COLOR_NAMES;
  protected readonly sliders = SLIDERS;
  protected readonly seasons = SEASONS;
  protected readonly seasonNames = SEASON_NAMES;
  protected readonly close = CLOSE;
  protected readonly Math = Math;

  private readonly tweaks = inject(Tweaks);
  private readonly backgroundColors = inject(Background).colors;
  /** The colors being tuned, in OKLCH, so that sliders keep the values they're set to. */
  private readonly oklch = signal(toOklch(this.tweaks.values().palette ?? PALETTE));
  private edited = false;

  protected readonly hexes = computed(() => this.oklch().map(oklchToHex));
  protected readonly tuned = computed(() => this.hexes().some((color, i) => color !== PALETTE[i]));
  private readonly pairs = computed(() => closestPairs(this.hexes()));
  protected readonly closest = computed(() => this.pairs().slice(0, 6));
  protected readonly colors = computed(() =>
    this.hexes().map((hex, index) => {
      const nearest = this.pairs().find((pair) => pair.first === index || pair.second === index);
      return {
        index,
        hex,
        oklch: this.oklch()[index] ?? [0, 0, 0],
        contrast: contrastWithWhite(hex),
        contrastNeeded: contrastNeeded(index),
        nearest: {
          index: nearest?.first === index ? nearest.second : (nearest?.first ?? index),
          difference: nearest?.difference ?? Infinity,
        },
      };
    }),
  );
  private readonly closePairs = computed(
    () =>
      new Set(
        this.pairs()
          .filter((pair) => pair.difference < CLOSE)
          .flatMap((pair) => [
            `${String(pair.first)}${String(pair.second)}`,
            `${String(pair.second)}${String(pair.first)}`,
          ]),
      ),
  );
  /** The first 100 decimals, in words of 5, in the colors being tuned. */
  protected readonly sample = computed(() => {
    const colors = placeColors(DECIMALS, this.hexes());
    const places = Array.from(DECIMALS, (digit, i) => ({ digit, color: colors[i] }));
    return Array.from({ length: places.length / 5 }, (_, i) => places.slice(i * 5, i * 5 + 5));
  });
  /** The season whose background the pairs and the decimals are shown on. */
  protected readonly background = signal<Season>('spring');

  constructor() {
    void this.tweaks.loaded.then(() => {
      if (!this.edited) {
        this.oklch.set(toOklch(this.tweaks.values().palette ?? PALETTE));
      }
    });
    this.showBackground('spring');
  }

  protected verdict(difference: number): string {
    if (difference < ALMOST_THE_SAME) {
      return ' · almost the same';
    }
    return difference < CLOSE ? ' · easy to mix up' : '';
  }

  protected isClose(row: number, column: number): boolean {
    return this.closePairs().has(`${String(row)}${String(column)}`);
  }

  protected tune(index: number, channel: number, event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }
    const value = Number(event.target.value);
    this.edited = true;
    this.oklch.update((colors) =>
      colors.map((color, i): Oklch => {
        if (i !== index) {
          return color;
        }
        const tunedColor: [number, number, number] = [...color];
        tunedColor[channel] = value;
        return tunedColor;
      }),
    );
    void this.tweaks.setPalette(this.tuned() ? this.hexes() : undefined);
  }

  protected reset(): void {
    this.edited = true;
    this.oklch.set(toOklch(PALETTE));
    void this.tweaks.setPalette(undefined);
  }

  /** Shows a season's starting background, as tuned, behind the page. */
  protected showBackground(season: Season): void {
    this.background.set(season);
    this.backgroundColors.set((this.tweaks.values().seasons ?? SEASON_STARTS)[season]);
  }
}

function toOklch(palette: readonly string[]): readonly Oklch[] {
  return palette.map(hexToOklch);
}
