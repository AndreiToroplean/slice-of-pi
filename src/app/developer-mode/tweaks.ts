import { computed, inject, Service, signal } from '@angular/core';
import { COLOR_SPACES, ColorSpace } from '../game/color/color-spaces';
import { Palette, PALETTE } from '../game/layers/place-colors';
import { writeBackup } from '../player-data/backup';
import { migrate, Migration } from '../player-data/migration';
import { RunOrder } from '../player-data/run';
import { RunStore } from '../player-data/run-store';
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
} from '../game/layers/seasons';
import { BreakModelKind, Settings } from '../game/grouping/break-models/break-model';
import {
  BREAK_MODELS,
  breakModelKindById,
  GAME_BREAK_MODEL,
} from '../game/grouping/break-models/break-models';
import { DeveloperMode } from './developer-mode';
import { Layout, LAYOUT, parseLayout } from '../ui/layout';

/** The name of the tweaks setting in the store. */
export const TWEAKS = 'tweaks';
/** The format of the stored tweaks, which changes, with a migration, whenever they do. */
export const TWEAKS_FORMAT = 2;
/** The steps that bring the stored tweaks in older formats to the current one, one per format (see {@link migrate}). */
const TWEAKS_MIGRATIONS: readonly Migration[] = [
  // Format 2 keeps each break model's hyperparameters apart: those stored before go to Mercury.
  ({ grouping, ...tweaks }) =>
    grouping === undefined ? tweaks : { ...tweaks, grouping: { mercury: grouping } },
];

/** Each season's starting background colors, top then bottom. */
export type SeasonStarts = Readonly<Record<Season, BackgroundColors>>;

/** The game's values tuned in developer mode. Those left out keep the game's own. */
export interface TweakValues {
  /** The 10 key colors, for {@link PALETTE}. */
  readonly palette?: Palette;
  /** The seasons' starting colors, for {@link SEASON_BACKGROUNDS}. */
  readonly seasons?: SeasonStarts;
  /** The name of the break model the groups come from, for the game's own (`BREAK_MODEL` in `break-models.ts`). */
  readonly breakModel?: string;
  /** The hyperparameters tuned for each break model, by its id, for its defaults: each keeps its own. */
  readonly grouping?: Readonly<Record<string, Settings>>;
  /** The keys of the hyperparameters pinned for each break model, by its id: fitting it leaves them where they are. */
  readonly pins?: Readonly<Record<string, readonly string[]>>;
  /** The color space the background blends its colors in, for {@link SEASON_COLOR_SPACE}. */
  readonly colorSpace?: ColorSpace;
  /** How many places a season takes to turn into the next, for {@link SEASON_TURN}. */
  readonly seasonTurn?: number;
  /** `false` to play without checking the digits, which the game otherwise always does. */
  readonly checking?: false;
  /** `false` to play without the countdown to the end of the group being typed, which developer mode otherwise shows. */
  readonly countdown?: false;
  /** `'clear'` for see-through keys, which are otherwise solid, in their colors. */
  readonly keys?: 'clear';
  /** `true` to count unchecked runs in the player's groups, which otherwise leave them out. */
  readonly includeUnchecked?: true;
  /** The order the game takes the runs in, and the line it plays from among them (see {@link RunOrder}). */
  readonly runOrder?: RunOrder;
  /** Where things sit on the screens, for {@link LAYOUT}. */
  readonly layout?: Layout;
}

/** The game's own starting colors of each season. */
export const SEASON_STARTS: SeasonStarts = Object.fromEntries(
  SEASONS.map((season) => [season, SEASON_BACKGROUNDS[season].early]),
) as Record<Season, BackgroundColors>;

/**
 * The game's values as tuned in developer mode: they apply to the whole game while developer mode is on, and the
 * game's own values apply otherwise. Kept with the player's data, so they survive turning developer mode off and on.
 * The game's own values never change here: tuned values go into the code once the owner is happy with them, from the
 * backup each page copies ({@link tweaksBackup}).
 */
@Service()
export class Tweaks {
  private readonly store = inject(RunStore);
  private readonly developerMode = inject(DeveloperMode);
  private readonly gameBreakModel = inject(GAME_BREAK_MODEL);
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
  /** The break model the groups come from. */
  readonly breakModelKind = computed(
    (): BreakModelKind =>
      (this.developerMode.enabled() ? breakModelKindById(this.tweaks().breakModel) : undefined) ??
      this.gameBreakModel,
  );
  /** The hyperparameters of that break model. */
  readonly grouping = computed(
    (): Settings =>
      (this.developerMode.enabled()
        ? this.tweaks().grouping?.[this.breakModelKind().id]
        : undefined) ?? this.breakModelKind().defaults,
  );
  /** That break model, with its hyperparameters set: all the game sees of it. */
  readonly breakModel = computed(() => this.breakModelKind().create(this.grouping()));
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

  /** Whether the game counts down to the end of the group being typed, which only developer mode does. */
  readonly countdown = computed(
    () => this.developerMode.enabled() && this.tweaks().countdown !== false,
  );

  /** Whether the keys are solid, in their colors, rather than see-through. */
  readonly solidKeys = computed(
    () => !this.developerMode.enabled() || this.tweaks().keys !== 'clear',
  );

  /** Whether the player's groups count unchecked runs, which may hold mistakes. */
  readonly includeUnchecked = computed(
    () => this.developerMode.enabled() && this.tweaks().includeUnchecked === true,
  );

  /** The order the game takes the runs in, and the line it plays from among them, unless it's the order they were played in. */
  readonly runOrder = computed(() =>
    this.developerMode.enabled() ? this.tweaks().runOrder : undefined,
  );

  /** Where things sit on the screens. */
  readonly layout = computed(
    (): Layout => (this.developerMode.enabled() ? this.tweaks().layout : undefined) ?? LAYOUT,
  );

  constructor() {
    this.loaded = this.store.setting(TWEAKS).then(async (stored) => {
      // Unless they were changed in the meantime.
      if (!this.changed) {
        await this.adopt(stored);
      }
    });
  }

  /** Reads the stored setting again, once something else changed it, such as restoring a backup. */
  async reload(): Promise<void> {
    await this.adopt(await this.store.setting(TWEAKS));
  }

  /** Tunes the key colors; `undefined` brings back the game's. */
  setPalette(palette: Palette | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), palette }));
  }

  /** Tunes the seasons' starting colors; `undefined` brings back the game's. */
  setSeasons(seasons: SeasonStarts | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), seasons }));
  }

  /** Picks the break model the groups come from, with the hyperparameters tuned for it, if any. */
  setBreakModel(kind: BreakModelKind): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), breakModel: kind.id }));
  }

  /** Tunes the hyperparameters of the break model picked; `undefined` brings back its defaults. The others keep theirs. */
  setGrouping(settings: Settings | undefined): Promise<void> {
    const { id } = this.breakModelKind();
    const others = Object.entries(this.tweaks().grouping ?? {}).filter(([key]) => key !== id);
    const grouping = [...others, ...(settings === undefined ? [] : [[id, settings] as const])];
    return this.save(
      tweakValues({
        ...this.tweaks(),
        grouping: grouping.length === 0 ? undefined : Object.fromEntries(grouping),
      }),
    );
  }

  /** The keys of the hyperparameters of a break model that are pinned, so that fitting it leaves them where they are. */
  pinsOf(kind: BreakModelKind): ReadonlySet<string> {
    return new Set(this.tweaks().pins?.[kind.id]);
  }

  /** Pins a hyperparameter of a break model, or unpins it. The other models keep their pins. */
  togglePin(kind: BreakModelKind, key: string): Promise<void> {
    const keys = this.pinsOf(kind);
    const next = keys.has(key) ? [...keys].filter((each) => each !== key) : [...keys, key];
    const others = Object.entries(this.tweaks().pins ?? {}).filter(([id]) => id !== kind.id);
    const pins = [...others, ...(next.length === 0 ? [] : [[kind.id, next] as const])];
    return this.save(
      tweakValues({
        ...this.tweaks(),
        pins: pins.length === 0 ? undefined : Object.fromEntries(pins),
      }),
    );
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

  /** Shows the countdown to the end of the group being typed, or hides it. */
  setCountdown(countdown: boolean): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), countdown: countdown ? undefined : false }));
  }

  /** Makes the keys solid, in their colors, or see-through. */
  setSolidKeys(solid: boolean): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), keys: solid ? undefined : 'clear' }));
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

  /** Moves things on the screens; `undefined` brings back the game's layout. */
  setLayout(layout: Layout | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), layout }));
  }

  /** Takes the tweaks of a stored setting, storing them again without those the game's own values have caught up with. */
  private async adopt(stored: unknown): Promise<void> {
    const parsed = parseTweaks(stored);
    if (equal(withoutDefaults(parsed, this.gameBreakModel), parsed)) {
      this.tweaks.set(parsed);
    } else {
      await this.save(parsed);
    }
  }

  private async save(values: TweakValues): Promise<void> {
    const next = withoutDefaults(values, this.gameBreakModel);
    this.changed = true;
    this.tweaks.set(next);
    await this.store.saveSetting(TWEAKS, { format: TWEAKS_FORMAT, ...next });
  }
}

/**
 * Tuned values as the text of a backup file holding them alone, in the tweaks setting, to hand back so they go into the
 * code: backups are the one format the game writes its values in, for players and for the owner alike.
 */
export function tweaksBackup(values: TweakValues, exportedAt: number): string {
  return writeBackup([], { [TWEAKS]: { format: TWEAKS_FORMAT, ...values } }, exportedAt);
}

/** The tweaks in a stored setting, leaving out what isn't valid. A format this version doesn't know gives none. */
export function parseTweaks(stored: unknown): TweakValues {
  if (typeof stored !== 'object' || stored === null) {
    return {};
  }
  const {
    format,
    palette,
    seasons,
    breakModel,
    grouping,
    pins,
    colorSpace,
    seasonTurn,
    checking,
    countdown,
    keys,
    includeUnchecked,
    runOrder,
    layout,
  } = migrate(stored, TWEAKS_MIGRATIONS);
  if (format !== TWEAKS_FORMAT) {
    return {};
  }
  return tweakValues({
    palette: isPalette(palette) ? palette : undefined,
    seasons: isSeasonStarts(seasons) ? seasons : undefined,
    breakModel: breakModelKindById(breakModel)?.id,
    grouping: groupingOf(grouping),
    pins: pinsOf(pins),
    colorSpace: isColorSpace(colorSpace) ? colorSpace : undefined,
    seasonTurn: isSeasonTurn(seasonTurn) ? seasonTurn : undefined,
    checking: checking === false ? checking : undefined,
    countdown: countdown === false ? countdown : undefined,
    keys: keys === 'clear' ? keys : undefined,
    includeUnchecked: includeUnchecked === true ? includeUnchecked : undefined,
    runOrder: runOrderOf(runOrder),
    layout: parseLayout(layout),
  });
}

/**
 * Tweaks, leaving out those at the game's own values, whether tuned back to them or since met by them: as tweaks, they'd
 * only keep the game's values from applying once those change.
 */
export function withoutDefaults(values: TweakValues, gameBreakModel: BreakModelKind): TweakValues {
  const { palette, seasons, breakModel, grouping, colorSpace, seasonTurn, layout } = values;
  const tuned = Object.entries(grouping ?? {}).filter(([id, settings]) => {
    const defaults = breakModelKindById(id)?.defaults;
    return (
      defaults === undefined || Object.keys(defaults).some((key) => settings[key] !== defaults[key])
    );
  });
  return tweakValues({
    ...values,
    palette: equal(palette, PALETTE) ? undefined : palette,
    seasons: equal(seasons, SEASON_STARTS) ? undefined : seasons,
    breakModel: breakModel === gameBreakModel.id ? undefined : breakModel,
    grouping: tuned.length === 0 ? undefined : Object.fromEntries(tuned),
    colorSpace: colorSpace === SEASON_COLOR_SPACE ? undefined : colorSpace,
    seasonTurn: seasonTurn === SEASON_TURN ? undefined : seasonTurn,
    layout: equal(layout, LAYOUT) ? undefined : layout,
  });
}

/** Whether two values, as read from JSON, are the same, whatever the order of their keys. */
function equal(a: unknown, b: unknown): boolean {
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return a === b;
  }
  const keys = Object.keys(a);
  return (
    Array.isArray(a) === Array.isArray(b) &&
    keys.length === Object.keys(b).length &&
    keys.every((key) =>
      equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  );
}

/** Tweaks, leaving out those that are `undefined`. */
function tweakValues({
  palette,
  seasons,
  breakModel,
  grouping,
  pins,
  colorSpace,
  seasonTurn,
  checking,
  countdown,
  keys,
  includeUnchecked,
  runOrder,
  layout,
}: {
  readonly [K in keyof TweakValues]: TweakValues[K] | undefined;
}): TweakValues {
  return {
    ...(palette === undefined ? {} : { palette }),
    ...(seasons === undefined ? {} : { seasons }),
    ...(breakModel === undefined ? {} : { breakModel }),
    ...(grouping === undefined ? {} : { grouping }),
    ...(pins === undefined ? {} : { pins }),
    ...(colorSpace === undefined ? {} : { colorSpace }),
    ...(seasonTurn === undefined ? {} : { seasonTurn }),
    ...(checking === undefined ? {} : { checking }),
    ...(countdown === undefined ? {} : { countdown }),
    ...(keys === undefined ? {} : { keys }),
    ...(includeUnchecked === undefined ? {} : { includeUnchecked }),
    ...(runOrder === undefined ? {} : { runOrder }),
    ...(layout === undefined ? {} : { layout }),
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

/** Each break model's hyperparameters stored, by its id, leaving out those of no model and of none kept. */
function groupingOf(value: unknown): Readonly<Record<string, Settings>> | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const stored = value as Record<string, unknown>;
  const kept = BREAK_MODELS.flatMap((kind) => {
    const settings = settingsOf(kind, stored[kind.id]);
    return settings === undefined ? [] : [[kind.id, settings] as const];
  });
  return kept.length === 0 ? undefined : Object.fromEntries(kept);
}

/** Each break model's pins stored, by its id, leaving out the keys of none of its hyperparameters, and models with none. */
function pinsOf(value: unknown): Readonly<Record<string, readonly string[]>> | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const stored = value as Record<string, unknown>;
  const kept = BREAK_MODELS.flatMap((kind) => {
    const keys: unknown = stored[kind.id];
    const pinned = kind.tabs
      .flatMap((tab) => tab.hyperparameters)
      .map(({ key }) => key)
      .filter((key) => Array.isArray(keys) && keys.includes(key));
    return pinned.length === 0 ? [] : [[kind.id, pinned] as const];
  });
  return kept.length === 0 ? undefined : Object.fromEntries(kept);
}

/**
 * A break model's hyperparameters stored, each one that's missing or out of its slider's range at its default, so that
 * adding or dropping one keeps the others. `undefined` if none is kept, as with the settings of the timing model the
 * break models replaced, which share none of their names.
 */
function settingsOf(kind: BreakModelKind, value: unknown): Settings | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const stored = value as Record<string, unknown>;
  const kept = kind.tabs
    .flatMap((tab) => tab.hyperparameters)
    .flatMap(({ key, min, max, step }) => {
      const setting = stored[key];
      return typeof setting === 'number' &&
        setting >= min &&
        setting <= max &&
        (Number.isInteger(setting) || !Number.isInteger(step))
        ? [[key, setting] as const]
        : [];
    });
  return kept.length === 0 ? undefined : { ...kind.defaults, ...Object.fromEntries(kept) };
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
