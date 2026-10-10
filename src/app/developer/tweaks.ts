import { computed, inject, Service, signal } from '@angular/core';
import { Palette, PALETTE } from '../place-colors/place-colors';
import { RunStore } from '../runs/run-store';
import {
  BackgroundColors,
  backgroundsFrom,
  Season,
  SEASON_BACKGROUNDS,
  SeasonBackgrounds,
  SEASONS,
} from '../seasons/seasons';
import { DeveloperMode } from './developer-mode';

/** The name of the tweaks setting in the store. */
export const TWEAKS = 'tweaks';
/** The format of the stored tweaks, which changes, with a migration, whenever they do (`architecture.md` §5). */
export const TWEAKS_FORMAT = 1;

/** Each season's starting background colors, top then bottom. */
export type SeasonStarts = Readonly<Record<Season, BackgroundColors>>;

/** The game's values tuned in developer mode. Those left out keep the game's own. */
export interface TweakValues {
  /** The 10 key colors, for {@link PALETTE}. */
  readonly palette?: Palette;
  /** The seasons' starting colors, for {@link SEASON_BACKGROUNDS}. */
  readonly seasons?: SeasonStarts;
}

/** The game's own starting colors of each season. */
export const SEASON_STARTS: SeasonStarts = Object.fromEntries(
  SEASONS.map((season) => [season, SEASON_BACKGROUNDS[season].early]),
) as Record<Season, BackgroundColors>;

/**
 * The game's values as tuned in developer mode: they apply to the whole game while developer mode is on, and the
 * game's own values apply otherwise. Kept with the player's data, so they survive turning developer mode off and on.
 * The game's own values never change here: tuned values go into the code once the owner is happy with them, from the
 * text {@link exportText} gives.
 */
@Service()
export class Tweaks {
  private readonly store = inject(RunStore);
  private readonly developerMode = inject(DeveloperMode);
  private readonly tweaks = signal<TweakValues>({});
  private changed = false;

  /** The tuned values, whether or not they apply. */
  readonly values = this.tweaks.asReadonly();
  /** Settles once the stored tweaks have been read. */
  readonly loaded: Promise<void>;

  /** The key colors the game uses. */
  readonly palette = computed(() =>
    this.developerMode.enabled() ? (this.tweaks().palette ?? PALETTE) : PALETTE,
  );
  /** The seasons' backgrounds the game uses. */
  readonly seasonBackgrounds = computed((): SeasonBackgrounds => {
    const seasons = this.tweaks().seasons;
    return this.developerMode.enabled() && seasons !== undefined
      ? backgroundsFrom(seasons)
      : SEASON_BACKGROUNDS;
  });

  constructor() {
    this.loaded = this.store.setting(TWEAKS).then((stored) => {
      // Unless they were changed in the meantime.
      if (!this.changed) {
        this.tweaks.set(parseTweaks(stored));
      }
    });
  }

  /** Tunes the key colors; `undefined` brings back the game's. */
  setPalette(palette: Palette | undefined): Promise<void> {
    return this.save(tweakValues(palette, this.tweaks().seasons));
  }

  /** Tunes the seasons' starting colors; `undefined` brings back the game's. */
  setSeasons(seasons: SeasonStarts | undefined): Promise<void> {
    return this.save(tweakValues(this.tweaks().palette, seasons));
  }

  /** The tuned values that differ from the game's, as text to hand back so they go into the code. */
  exportText(): string {
    const { palette, seasons } = this.tweaks();
    const lines: string[] = [];
    if (palette?.some((color, i) => color !== PALETTE[i]) === true) {
      lines.push(
        'Key colors (PALETTE in place-colors.ts), keys 0 to 9:',
        ...palette.map((color, i) => `  ${String(i)}: ${color}`),
      );
    }
    const changedSeasons = SEASONS.filter((season) =>
      seasons?.[season].some((color, k) => color !== SEASON_STARTS[season][k]),
    );
    if (seasons !== undefined && changedSeasons.length > 0) {
      lines.push(
        'Season colors (early colors in SEASON_BACKGROUNDS in seasons.ts), top then bottom:',
        ...changedSeasons.map(
          (season) => `  ${season}: ${seasons[season][0]}, ${seasons[season][1]}`,
        ),
      );
    }
    return lines.length === 0
      ? "Slice of Pi tweaks: none, the game's values are unchanged."
      : ['Slice of Pi tweaks', ...lines].join('\n');
  }

  private async save(next: TweakValues): Promise<void> {
    this.changed = true;
    this.tweaks.set(next);
    await this.store.saveSetting(TWEAKS, { format: TWEAKS_FORMAT, ...next });
  }
}

/** The tweaks in a stored setting, leaving out what isn't valid. A format this version doesn't know gives none. */
export function parseTweaks(stored: unknown): TweakValues {
  if (
    typeof stored !== 'object' ||
    stored === null ||
    !('format' in stored) ||
    stored.format !== TWEAKS_FORMAT
  ) {
    return {};
  }
  const palette = 'palette' in stored ? stored.palette : undefined;
  const seasons = 'seasons' in stored ? stored.seasons : undefined;
  return tweakValues(
    isPalette(palette) ? palette : undefined,
    isSeasonStarts(seasons) ? seasons : undefined,
  );
}

/** Tweaks, leaving out those that are `undefined`. */
function tweakValues(palette: Palette | undefined, seasons: SeasonStarts | undefined): TweakValues {
  return {
    ...(palette === undefined ? {} : { palette }),
    ...(seasons === undefined ? {} : { seasons }),
  };
}

function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/.test(value);
}

function isPalette(value: unknown): value is Palette {
  return Array.isArray(value) && value.length === PALETTE.length && value.every(isColor);
}

function isSeasonStarts(value: unknown): value is SeasonStarts {
  return (
    typeof value === 'object' &&
    value !== null &&
    SEASONS.every((season) => {
      const colors: unknown = (value as Record<string, unknown>)[season];
      return Array.isArray(colors) && colors.length === 2 && colors.every(isColor);
    })
  );
}
