import { computed, inject, Service, signal } from '@angular/core';
import { COLOR_SPACE_NAMES, COLOR_SPACES, ColorSpace } from '../colors/color-spaces';
import { Palette, PALETTE } from '../place-colors/place-colors';
import { migrate, Migration } from '../runs/migration';
import { RunOrder } from '../runs/run';
import { RunStore } from '../runs/run-store';
import {
  BackgroundColors,
  backgroundsFrom,
  Season,
  SEASON_BACKGROUNDS,
  PLACES_PER_SEASON,
  SEASON_COLOR_SPACE,
  SEASON_TURN,
  SeasonBackgrounds,
  SEASONS,
} from '../seasons/seasons';
import { BreakSettings, DEFAULT_BREAK_SETTINGS } from '../timing/break-model';
import { DeveloperMode } from './developer-mode';

/** The name of the tweaks setting in the store. */
export const TWEAKS = 'tweaks';
/** The format of the stored tweaks, which changes, with a migration, whenever they do (`architecture.md` §5). */
export const TWEAKS_FORMAT = 1;
/** The steps that bring the stored tweaks in older formats to the current one, one per format (see {@link migrate}). */
const TWEAKS_MIGRATIONS: readonly Migration[] = [];

/** Each season's starting background colors, top then bottom. */
export type SeasonStarts = Readonly<Record<Season, BackgroundColors>>;

/** The game's values tuned in developer mode. Those left out keep the game's own. */
export interface TweakValues {
  /** The 10 key colors, for {@link PALETTE}. */
  readonly palette?: Palette;
  /** The seasons' starting colors, for {@link SEASON_BACKGROUNDS}. */
  readonly seasons?: SeasonStarts;
  /** The hyperparameters of the break model, for {@link DEFAULT_BREAK_SETTINGS}. */
  readonly grouping?: BreakSettings;
  /** The color space the background blends its colors in, for {@link SEASON_COLOR_SPACE}. */
  readonly colorSpace?: ColorSpace;
  /** How many places a season takes to turn into the next, for {@link SEASON_TURN}. */
  readonly seasonTurn?: number;
  /** `false` to play without checking the digits, which the game otherwise always does. */
  readonly checking?: false;
  /** `true` to count unchecked runs in the player's groups, which otherwise leave them out. */
  readonly includeUnchecked?: true;
  /** The order the game takes the runs in, and the line it plays from among them (see {@link RunOrder}). */
  readonly runOrder?: RunOrder;
}

/** The game's own starting colors of each season. */
export const SEASON_STARTS: SeasonStarts = Object.fromEntries(
  SEASONS.map((season) => [season, SEASON_BACKGROUNDS[season].early]),
) as Record<Season, BackgroundColors>;

/**
 * The game's values as tuned in developer mode: they apply to the whole game while developer mode is on, and the
 * game's own values apply otherwise. Kept with the player's data, so they survive turning developer mode off and on.
 * The game's own values never change here: tuned values go into the code once the owner is happy with them, from the
 * text each page copies ({@link paletteText}, {@link seasonsText}, {@link groupingText}).
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
  /** The hyperparameters of the break model the game uses. */
  readonly grouping = computed(() =>
    this.developerMode.enabled()
      ? (this.tweaks().grouping ?? DEFAULT_BREAK_SETTINGS)
      : DEFAULT_BREAK_SETTINGS,
  );
  /** The color space the background blends its colors in. */
  readonly colorSpace = computed(
    (): ColorSpace =>
      (this.developerMode.enabled() ? this.tweaks().colorSpace : undefined) ?? SEASON_COLOR_SPACE,
  );
  /** How many places a season takes to turn into the next. */
  readonly seasonTurn = computed(
    () => (this.developerMode.enabled() ? this.tweaks().seasonTurn : undefined) ?? SEASON_TURN,
  );

  /** Whether the game checks the digits typed against π. */
  readonly checking = computed(
    () => !this.developerMode.enabled() || this.tweaks().checking !== false,
  );

  /** Whether the player's groups count unchecked runs, which may hold mistakes. */
  readonly includeUnchecked = computed(
    () => this.developerMode.enabled() && this.tweaks().includeUnchecked === true,
  );

  /** The order the game takes the runs in, and the line it plays from among them, unless it's the order they were played in. */
  readonly runOrder = computed(() =>
    this.developerMode.enabled() ? this.tweaks().runOrder : undefined,
  );

  constructor() {
    this.loaded = this.store.setting(TWEAKS).then((stored) => {
      // Unless they were changed in the meantime.
      if (!this.changed) {
        this.tweaks.set(parseTweaks(stored));
      }
    });
  }

  /** Reads the stored setting again, once something else changed it, such as restoring a backup. */
  async reload(): Promise<void> {
    this.tweaks.set(parseTweaks(await this.store.setting(TWEAKS)));
  }

  /** Tunes the key colors; `undefined` brings back the game's. */
  setPalette(palette: Palette | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), palette }));
  }

  /** Tunes the seasons' starting colors; `undefined` brings back the game's. */
  setSeasons(seasons: SeasonStarts | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), seasons }));
  }

  /** Tunes the hyperparameters of the break model; `undefined` brings back the game's. */
  setGrouping(grouping: BreakSettings | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), grouping }));
  }

  /** Sets the color space the background blends its colors in; `undefined` brings back the game's. */
  setColorSpace(colorSpace: ColorSpace | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), colorSpace }));
  }

  /** Sets how many places a season takes to turn into the next; `undefined` brings back the game's. */
  setSeasonTurn(seasonTurn: number | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), seasonTurn }));
  }

  /** Turns checking the digits typed on or off. */
  setChecking(checking: boolean): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), checking: checking ? undefined : false }));
  }

  /** Counts unchecked runs in the player's groups, or leaves them out. */
  setIncludeUnchecked(includeUnchecked: boolean): Promise<void> {
    return this.save(
      tweakValues({ ...this.tweaks(), includeUnchecked: includeUnchecked ? true : undefined }),
    );
  }

  /** Puts the runs in an order, maybe with a line to play from among them; `undefined` puts them back in the order played. */
  setRunOrder(runOrder: RunOrder | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), runOrder }));
  }

  private async save(next: TweakValues): Promise<void> {
    this.changed = true;
    this.tweaks.set(next);
    await this.store.saveSetting(TWEAKS, { format: TWEAKS_FORMAT, ...next });
  }
}

/** Key colors as text to hand back so they go into the code, saying whether they differ from the game's. */
export function paletteText(palette: Palette): string {
  const changed = palette.some((color, i) => color !== PALETTE[i]);
  return [
    `Key colors (PALETTE in place-colors.ts), keys 0 to 9${changed ? '' : ", the game's own"}:`,
    ...palette.map((color, i) => `  ${String(i)}: ${color}`),
  ].join('\n');
}

/**
 * The seasons' starting colors, the color space they blend in and how long they take to turn, as text to hand back so
 * they go into the code, marking what differs.
 */
export function seasonsText(
  seasons: SeasonStarts,
  colorSpace: ColorSpace,
  seasonTurn: number,
): string {
  const changed = (yes: boolean): string => (yes ? ' (changed)' : '');
  return [
    'Season colors (early colors in SEASON_BACKGROUNDS in seasons.ts), top then bottom:',
    ...SEASONS.map(
      (season) =>
        `  ${season}: ${seasons[season][0]}, ${seasons[season][1]}${changed(
          seasons[season].some((color, k) => color !== SEASON_STARTS[season][k]),
        )}`,
    ),
    `Blended in ${COLOR_SPACE_NAMES[colorSpace]} (SEASON_COLOR_SPACE in seasons.ts)${changed(colorSpace !== SEASON_COLOR_SPACE)}`,
    `Turning over ${String(seasonTurn)} digit${seasonTurn === 1 ? '' : 's'} (SEASON_TURN in seasons.ts)${changed(seasonTurn !== SEASON_TURN)}`,
  ].join('\n');
}

/** The hyperparameters of the break model as text to hand back so they go into the code, marking those that differ. */
export function groupingText(settings: BreakSettings): string {
  return [
    'Grouping settings (DEFAULT_BREAK_SETTINGS in break-model.ts):',
    ...SETTING_KEYS.map((key) => {
      const value = settings[key];
      const changed = value !== DEFAULT_BREAK_SETTINGS[key];
      return `  ${key}: ${String(Number(value.toPrecision(4)))}${changed ? ' (changed)' : ''}`;
    }),
  ].join('\n');
}

const SETTING_KEYS = Object.keys(DEFAULT_BREAK_SETTINGS) as (keyof BreakSettings)[];

/** The tweaks in a stored setting, leaving out what isn't valid. A format this version doesn't know gives none. */
export function parseTweaks(stored: unknown): TweakValues {
  if (typeof stored !== 'object' || stored === null) {
    return {};
  }
  const {
    format,
    palette,
    seasons,
    grouping,
    colorSpace,
    seasonTurn,
    checking,
    includeUnchecked,
    runOrder,
  } = migrate(stored, TWEAKS_MIGRATIONS);
  if (format !== TWEAKS_FORMAT) {
    return {};
  }
  return tweakValues({
    palette: isPalette(palette) ? palette : undefined,
    seasons: isSeasonStarts(seasons) ? seasons : undefined,
    grouping: breakSettingsOf(grouping),
    colorSpace: isColorSpace(colorSpace) ? colorSpace : undefined,
    seasonTurn: isSeasonTurn(seasonTurn) ? seasonTurn : undefined,
    checking: checking === false ? checking : undefined,
    includeUnchecked: includeUnchecked === true ? includeUnchecked : undefined,
    runOrder: runOrderOf(runOrder),
  });
}

/** Tweaks, leaving out those that are `undefined`. */
function tweakValues({
  palette,
  seasons,
  grouping,
  colorSpace,
  seasonTurn,
  checking,
  includeUnchecked,
  runOrder,
}: {
  readonly [K in keyof TweakValues]: TweakValues[K] | undefined;
}): TweakValues {
  return {
    ...(palette === undefined ? {} : { palette }),
    ...(seasons === undefined ? {} : { seasons }),
    ...(grouping === undefined ? {} : { grouping }),
    ...(colorSpace === undefined ? {} : { colorSpace }),
    ...(seasonTurn === undefined ? {} : { seasonTurn }),
    ...(checking === undefined ? {} : { checking }),
    ...(includeUnchecked === undefined ? {} : { includeUnchecked }),
    ...(runOrder === undefined ? {} : { runOrder }),
  };
}

/** The order of the runs, read from untrusted data, or `undefined` if invalid. */
function runOrderOf(value: unknown): RunOrder | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('ids' in value) ||
    !Array.isArray(value.ids) ||
    !value.ids.every((id) => typeof id === 'string' && id !== '') ||
    new Set(value.ids).size !== value.ids.length
  ) {
    return undefined;
  }
  const ids = value.ids as string[];
  if (!('line' in value)) {
    return { ids };
  }
  const { line } = value;
  return Number.isInteger(line) && Number(line) >= 0 && Number(line) <= ids.length
    ? { ids, line: Number(line) }
    : undefined;
}

function isColorSpace(value: unknown): value is ColorSpace {
  return COLOR_SPACES.some((space) => space === value);
}

function isSeasonTurn(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= PLACES_PER_SEASON;
}

/** Whether a value is in range for each grouping setting. */
const BREAK_SETTING_CHECKS: { readonly [K in keyof BreakSettings]: (value: number) => boolean } = {
  window: (value) => Number.isInteger(value) && value > 0,
  recencyDecay: (value) => value > 0 && value <= 1,
  level: (value) => value >= 0 && value <= 1,
  priorStrength: (value) => value >= 0,
  syntheticRuns: (value) => Number.isInteger(value) && value >= 0,
  syntheticDecay: (value) => value > 0 && value <= 1,
  priorBaseline: (value) => value > 0,
  priorBreakShare: (value) => value > 0 && value < 1,
  priorBreakSize: (value) => value > 0,
  priorNormalSpread: (value) => value > 0,
  priorBreakSpread: (value) => value > 0,
  breakThreshold: (value) => value > 0 && value < 1,
  usualThreshold: (value) => value > 0 && value < 1,
  startingSlots: (value) => Number.isInteger(value) && value > 0,
};

/**
 * The grouping settings stored, each one that's missing or out of range at its default, so that adding or dropping a
 * setting keeps the others. `undefined` if none is kept, as with the settings of the timing model the break model
 * replaced, which share none of its names.
 */
function breakSettingsOf(value: unknown): BreakSettings | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const stored = value as Record<string, unknown>;
  const kept = Object.entries(stored).filter(
    ([key, setting]) =>
      key in BREAK_SETTING_CHECKS &&
      typeof setting === 'number' &&
      BREAK_SETTING_CHECKS[key as keyof BreakSettings](setting),
  );
  return kept.length === 0 ? undefined : { ...DEFAULT_BREAK_SETTINGS, ...Object.fromEntries(kept) };
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
