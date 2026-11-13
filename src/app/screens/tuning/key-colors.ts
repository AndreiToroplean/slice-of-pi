import { Component, computed, inject, signal } from '@angular/core';
import { Background } from '../../ui/background';
import { Candy } from '../../ui/candy';
import { Segment, Segmented } from '../../ui/segmented';
import { ACTION_KEY_COLOR } from '../play/keypad/action-keys';
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

/** The action keys' name, as the page shows it. */
const ACTION_KEYS_NAME = 'Action Keys';

/** The page's tabs: the digit keys, or the action keys. */
type KeysTab = 'digits' | 'actions';

/**
 * Developer mode's page to tune the keys' colors, fitting the screen, on a season's background, in two tabs. The digit
 * keys': every pair of them side by side, outlined where they're easy to mix up; selecting a key, at the start of its
 * row or anywhere on it, tunes it in the color picker under them. The action keys' (see `ACTION_KEY_COLOR`): one shown
 * as on the keypad, tuned in the same picker.
 */
@Component({
  selector: 'app-key-colors',
  imports: [Candy, ColorPicker, CopyValues, Page, Segmented],
  template: `
    <app-page heading="Key Colors">
      <button pageAction type="button" appCandy="danger" [disabled]="!tuned()" (click)="reset()">
        Reset All
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
      <app-segmented label="Keys" panels="keys" [segments]="tabs" [(value)]="tab" />
      <div
        class="grid"
        role="tabpanel"
        id="keys-digits"
        aria-labelledby="keys-tab-digits"
        [hidden]="tab() !== 'digits'"
      >
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
      <div
        class="actions"
        role="tabpanel"
        id="keys-actions"
        aria-labelledby="keys-tab-actions"
        [hidden]="tab() !== 'actions'"
      >
        <!-- An action key, as on the keypad, its color shown. -->
        <button type="button" appCandy="clear" class="action-key" [pressColor]="actions()">
          {{ actionKeysName }}
        </button>
      </div>
      <app-color-picker
        [color]="picked().color"
        [name]="picked().name"
        [neighbors]="picked().neighbors"
        [defaultColor]="picked().defaultColor"
        (colorChange)="tune($event)"
      />
      <app-copy-values [values]="{ palette: hexes(), actionKeys: actions() }" />
    </app-page>
  `,
  styleUrl: './key-colors.css',
})
export class KeyColors {
  protected readonly seasons = SEASONS;
  protected readonly seasonNames = SEASON_NAMES;
  protected readonly palette = PALETTE;
  protected readonly tabs: readonly Segment<KeysTab>[] = [
    { value: 'digits', label: 'Digit Keys' },
    { value: 'actions', label: ACTION_KEYS_NAME },
  ];
  protected readonly actionKeysName = ACTION_KEYS_NAME;

  private readonly tweaks = inject(Tweaks);
  private readonly backgroundColors = inject(Background).colors;
  /** The colors being tuned. */
  protected readonly hexes = signal<Palette>(this.tweaks.values().palette ?? PALETTE);
  /** The key whose color is in the picker. */
  protected readonly selected = signal(0);
  /** The tab shown, whose keys the picker tunes. */
  protected readonly tab = signal<KeysTab>('digits');
  /** The action keys' color being tuned. */
  protected readonly actions = signal(this.tweaks.actionKeys());

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
  protected readonly tuned = computed(
    () =>
      this.hexes().some((color, i) => color !== PALETTE[i]) || this.actions() !== ACTION_KEY_COLOR,
  );
  /** What the picker tunes: the key selected in the tab shown. */
  protected readonly picked = computed(() => {
    if (this.tab() === 'digits') {
      return {
        color: this.hexes()[this.selected()] ?? '#000000',
        name: this.names()[this.selected()] ?? '',
        neighbors: this.neighbors(),
        defaultColor: PALETTE[this.selected()] ?? '#000000',
      };
    }
    return {
      color: this.actions(),
      name: ACTION_KEYS_NAME,
      neighbors: undefined,
      defaultColor: ACTION_KEY_COLOR,
    };
  });
  /** The season whose background the grid is shown on. */
  protected readonly background = signal<Season>('spring');

  constructor() {
    this.showBackground('spring');
  }

  protected isClose(row: string, column: string): boolean {
    return row !== column && colorDifference(row, column) < CLOSE;
  }

  /** Sets the color of the key selected in the tab shown. */
  protected tune(color: string): void {
    if (this.tab() === 'digits') {
      this.hexes.update((colors) => colors.map((old, i) => (i === this.selected() ? color : old)));
      void this.tweaks.setPalette(this.hexes());
    } else {
      this.actions.set(color);
      void this.tweaks.setActionKeys(color);
    }
  }

  protected reset(): void {
    this.hexes.set(PALETTE);
    this.actions.set(ACTION_KEY_COLOR);
    void this.tweaks.setPalette(undefined);
    void this.tweaks.setActionKeys(undefined);
  }

  /** Shows a season's starting background, as tuned, behind the page. */
  protected showBackground(season: Season): void {
    this.background.set(season);
    this.backgroundColors.set((this.tweaks.values().seasons ?? SEASON_STARTS)[season]);
  }
}
