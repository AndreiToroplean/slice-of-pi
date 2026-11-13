import { computed, inject, Service, signal } from '@angular/core';
import { COLOR_SPACES, ColorSpace } from '../game/color/color-spaces';
import {
  DISCOVER_SPEED,
  isDiscoverSpeed,
  isPaceStep,
  GAME_LINGER,
  GROUP_PAUSE,
  HAND_OVER,
  isGameLinger,
  isGroupPause,
  isHandOver,
  PACE_STEP,
} from '../game/modes/discover-pace';
import { isKeyLinger, KEY_LINGER, Palette, PALETTE } from '../game/layers/place-colors';
import { BREATH, isBreath } from '../ui/breath';
import { isUnavailable, UNAVAILABLE } from '../ui/unavailable';
import { OTHER_KEY_COLORS, OTHER_KEYS, OtherKeyColors } from '../screens/play/keypad/other-keys';
import { CHECKPOINT_LAG, isCheckpointLag } from '../game/modes/discover-rounds';
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
import { MENU_LOOK, MenuLook, parseMenuLook, TWILIGHT } from '../screens/menu/menu-look';
import {
  parsePattern,
  Vibration,
  VIBRATION_PATTERNS,
  VibrationPattern,
  VibrationPatterns,
  VIBRATIONS,
} from '../feedback/vibrations';
import { MIX_SLIDERS, SOUND_MIX, SoundMix, SoundSlider } from '../feedback/sound-mix';
import { Souring, SOURING, SOURING_SLIDERS } from '../feedback/souring';
import { KEY_MOTION, KeyMotion } from '../screens/play/keypad/key-merges';
import { KEY_MOTION_SLIDERS } from '../screens/play/keypad/key-motion-sliders';
import { SoundModel, SoundModelKind } from '../game/layers/sound/sound-model';
import { SOUND_MODEL, soundModelKindById } from '../game/layers/sound/sound-models';

/** The name of the tweaks setting in the store. */
export const TWEAKS = 'tweaks';
/** The format of the stored tweaks, which changes, with a migration, whenever they do. */
export const TWEAKS_FORMAT = 4;
/** The steps that bring the stored tweaks in older formats to the current one, one per format (see {@link migrate}). */
const TWEAKS_MIGRATIONS: readonly Migration[] = [
  // Format 2 keeps each break model's hyperparameters apart: those stored before go to Mercury.
  ({ grouping, ...tweaks }) =>
    grouping === undefined ? tweaks : { ...tweaks, grouping: { mercury: grouping } },
  // Format 3 lays the screens out by their margins, as edit mode edits them: the layout stored before goes.
  (tweaks) => Object.fromEntries(Object.entries(tweaks).filter(([key]) => key !== 'layout')),
  // Format 4 sets how loud words land in the mix: those that landed silently land at 0.
  ({ landings, ...tweaks }) =>
    landings === false ? { ...tweaks, sound: { ...Object(tweaks['sound']), landings: 0 } } : tweaks,
];

/** Each season's starting background colors, top then bottom. */
export type SeasonStarts = Readonly<Record<Season, BackgroundColors>>;

/** The game's values tuned in developer mode. Those left out keep the game's own. */
export interface TweakValues {
  /** The 10 key colors, for {@link PALETTE}. */
  readonly palette?: Palette;
  /** The seasons' starting colors, for {@link SEASON_BACKGROUNDS}. */
  readonly seasons?: SeasonStarts;
  /** The main menu's background colors, top then bottom, for {@link TWILIGHT}. */
  readonly twilight?: BackgroundColors;
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
  /** How long a digit key's color lingers once released, in milliseconds, for {@link KEY_LINGER}. */
  readonly keyLinger?: number;
  /** How far a candy button's sides move as it breathes out all the way, in CSS pixels, for {@link BREATH}. */
  readonly breath?: number;
  /** How much of an unavailable candy button's paint shows, in percent, for {@link UNAVAILABLE}. */
  readonly unavailable?: number;
  /** The colors of the keys besides the digit keys, for {@link OTHER_KEY_COLORS}. */
  readonly otherKeys?: OtherKeyColors;
  /** How many digits a second Discover plays at its medium pace, for {@link DISCOVER_SPEED}. */
  readonly discoverSpeed?: number;
  /** How much slower or faster than the medium pace Discover's others are, in percent, for {@link PACE_STEP}. */
  readonly paceStep?: number;
  /** How long Discover takes to hand a turn over, in milliseconds, for {@link HAND_OVER}. */
  readonly handOver?: number;
  /** How much longer Discover's game waits between groups than between digits, in percent, for {@link GROUP_PAUSE}. */
  readonly groupPause?: number;
  /** How many times longer keys linger on Discover's turn, for {@link GAME_LINGER}. */
  readonly gameLinger?: number;
  /** `false` to play without checking the digits, which the game otherwise always does. */
  readonly checking?: false;
  /** `true` to show the countdown to the end of the group being typed, in developer mode, which is otherwise hidden. */
  readonly countdown?: true;
  /**
   * `true` for Discover's rounds to move on to checkpoints as the player picks them, which they otherwise do by
   * themselves, lagging behind (see `laggingCheckpoint`).
   */
  readonly manualCheckpoints?: true;
  /** How many checkpoints behind the farthest reached the rounds move on to by themselves, for {@link CHECKPOINT_LAG}. */
  readonly checkpointLag?: number;
  /** `'solid'` for keys solid, in their colors, which are otherwise see-through. */
  readonly keys?: 'solid';
  /** `true` to include unchecked runs: shown on the pages of runs, and counted in the player's groups. */
  readonly includeUnchecked?: true;
  /** The order the game takes the runs in, and the line it plays from among them (see {@link RunOrder}). */
  readonly runOrder?: RunOrder;
  /** Where things sit on the screens, for {@link LAYOUT}. */
  readonly layout?: Layout;
  /** How the main menu looks, for {@link MENU_LOOK}. */
  readonly menu?: MenuLook;
  /** The patterns the phone vibrates in, those tuned, for theirs in {@link VIBRATION_PATTERNS}. */
  readonly vibrations?: Partial<VibrationPatterns>;
  /** The name of the sound model the keys are played with, for {@link SOUND_MODEL}. */
  readonly soundModel?: string;
  /** How loud the sounds are, and how long they ring, for {@link SOUND_MIX}. */
  readonly sound?: SoundMix;
  /** How a wrong key's note goes off, for {@link SOURING}. */
  readonly souring?: Souring;
  /** `true` to show, in developer mode, what each key typed played, in words, which is otherwise hidden. */
  readonly soundNotes?: true;
  /** How long the keypad's keys take to move, for {@link KEY_MOTION}. */
  readonly keyMotion?: KeyMotion;
}

/** The game's own starting colors of each season. */
export const SEASON_STARTS: SeasonStarts = Object.fromEntries(
  SEASONS.map((season) => [season, SEASON_BACKGROUNDS[season].early]),
) as Record<Season, BackgroundColors>;

/**
 * The game's values as tuned in developer mode: they apply to the whole game while developer mode is on, and the
 * game's own values apply otherwise. Kept with the player's data, so they survive turning developer mode off and on.
 * The game's own values never change here: tuned values become the game's own once the owner is happy with them, from
 * the backup each page copies ({@link tweaksBackup}), promoted into `game-values.json` (see `GAME_VALUES`).
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
  /** The main menu's background colors. */
  readonly twilight = computed(
    (): BackgroundColors =>
      (this.developerMode.enabled() ? this.tweaks().twilight : undefined) ?? TWILIGHT,
  );
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
  /** How long a digit key's color lingers once released, in milliseconds. */
  readonly keyLinger = computed(
    () => (this.developerMode.enabled() ? this.tweaks().keyLinger : undefined) ?? KEY_LINGER,
  );
  /** How far a candy button's sides move as it breathes out all the way, in CSS pixels. */
  readonly breath = computed(
    () => (this.developerMode.enabled() ? this.tweaks().breath : undefined) ?? BREATH,
  );
  /** How much of an unavailable candy button's paint shows, in percent. */
  readonly unavailable = computed(
    () => (this.developerMode.enabled() ? this.tweaks().unavailable : undefined) ?? UNAVAILABLE,
  );
  /** The colors of the keys besides the digit keys. */
  readonly otherKeys = computed(
    () => (this.developerMode.enabled() ? this.tweaks().otherKeys : undefined) ?? OTHER_KEY_COLORS,
  );
  /** How many digits a second Discover plays at its medium pace. */
  readonly discoverSpeed = computed(
    () =>
      (this.developerMode.enabled() ? this.tweaks().discoverSpeed : undefined) ?? DISCOVER_SPEED,
  );
  /** How much slower or faster than the medium pace Discover's others are, in percent. */
  readonly paceStep = computed(
    () => (this.developerMode.enabled() ? this.tweaks().paceStep : undefined) ?? PACE_STEP,
  );
  /** How long Discover takes to hand a turn over, in milliseconds. */
  readonly handOver = computed(
    () => (this.developerMode.enabled() ? this.tweaks().handOver : undefined) ?? HAND_OVER,
  );
  /** How much longer Discover's game waits between groups than between digits, in percent. */
  readonly groupPause = computed(
    () => (this.developerMode.enabled() ? this.tweaks().groupPause : undefined) ?? GROUP_PAUSE,
  );
  /** How many times longer keys linger on Discover's turn. */
  readonly gameLinger = computed(
    () => (this.developerMode.enabled() ? this.tweaks().gameLinger : undefined) ?? GAME_LINGER,
  );

  /** Whether the game checks the digits typed against π. */
  readonly checking = computed(
    () => !this.developerMode.enabled() || this.tweaks().checking !== false,
  );

  /** Whether the game counts down to the end of the group being typed, which only developer mode does, once told to. */
  readonly countdown = computed(
    () => this.developerMode.enabled() && this.tweaks().countdown === true,
  );
  /** Whether Discover's rounds move on to checkpoints as the player picks them, rather than by themselves. */
  readonly manualCheckpoints = computed(
    () => this.developerMode.enabled() && this.tweaks().manualCheckpoints === true,
  );
  /** How many checkpoints behind the farthest reached the rounds move on to by themselves. */
  readonly checkpointLag = computed(
    () =>
      (this.developerMode.enabled() ? this.tweaks().checkpointLag : undefined) ?? CHECKPOINT_LAG,
  );

  /** Whether the keys are solid, in their colors, rather than see-through. */
  readonly solidKeys = computed(
    () => this.developerMode.enabled() && this.tweaks().keys === 'solid',
  );

  /** Whether unchecked runs, which may hold mistakes, are included: shown on the pages of runs, and counted in the groups. */
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

  /** How the main menu looks. */
  readonly menu = computed(
    (): MenuLook => (this.developerMode.enabled() ? this.tweaks().menu : undefined) ?? MENU_LOOK,
  );

  /** The patterns the phone vibrates in. */
  readonly vibrationPatterns = computed((): VibrationPatterns =>
    this.developerMode.enabled()
      ? { ...VIBRATION_PATTERNS, ...this.tweaks().vibrations }
      : VIBRATION_PATTERNS,
  );

  /** The sound model the keys are played with. */
  readonly soundModelKind = computed(
    (): SoundModelKind =>
      (this.developerMode.enabled() ? soundModelKindById(this.tweaks().soundModel) : undefined) ??
      SOUND_MODEL,
  );
  /** That sound model, made once for each pick, as it keeps the song it works out. */
  readonly soundModel = computed((): SoundModel => this.soundModelKind().create());
  /** How loud the sounds are, and how long they ring. */
  readonly soundMix = computed(
    (): SoundMix => (this.developerMode.enabled() ? this.tweaks().sound : undefined) ?? SOUND_MIX,
  );

  /** How a wrong key's note goes off as it rings. */
  readonly souring = computed(
    (): Souring => (this.developerMode.enabled() ? this.tweaks().souring : undefined) ?? SOURING,
  );

  /** Whether the play screen shows what each key typed played, which only developer mode does, once told to. */
  readonly soundNotes = computed(
    () => this.developerMode.enabled() && this.tweaks().soundNotes === true,
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

  /** Tunes the main menu's background colors; `undefined` brings back the game's. */
  setTwilight(twilight: BackgroundColors | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), twilight }));
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

  /** Sets how long a digit key's color lingers once released; `undefined` brings back the game's. */
  setKeyLinger(keyLinger: number | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), keyLinger }));
  }

  /** Sets how far candy buttons breathe; `undefined` brings back the game's. */
  setBreath(breath: number | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), breath }));
  }

  /** Sets how much of an unavailable candy button's paint shows; `undefined` brings back the game's. */
  setUnavailable(unavailable: number | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), unavailable }));
  }

  /** Sets the colors of the keys besides the digit keys; `undefined` brings back the game's. */
  setOtherKeys(otherKeys: OtherKeyColors | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), otherKeys }));
  }

  /** Sets how many digits a second Discover plays at its medium pace; `undefined` brings back the game's. */
  setDiscoverSpeed(discoverSpeed: number | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), discoverSpeed }));
  }

  /** Sets how much slower or faster Discover's other paces are, in percent; `undefined` brings back the game's. */
  setPaceStep(paceStep: number | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), paceStep }));
  }

  /** Sets how long Discover takes to hand a turn over; `undefined` brings back the game's. */
  setHandOver(handOver: number | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), handOver }));
  }

  /** Sets how much longer Discover's game waits between groups; `undefined` brings back the game's. */
  setGroupPause(groupPause: number | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), groupPause }));
  }

  /** Sets how many times longer keys linger on Discover's turn; `undefined` brings back the game's. */
  setGameLinger(gameLinger: number | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), gameLinger }));
  }

  /** Turns checking the digits typed on or off. */
  setChecking(checking: boolean): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), checking: checking ? undefined : false }));
  }

  /** Has Discover's rounds move on to checkpoints as the player picks them, or by themselves. */
  setManualCheckpoints(manual: boolean): Promise<void> {
    return this.save(
      tweakValues({ ...this.tweaks(), manualCheckpoints: manual ? true : undefined }),
    );
  }

  /** Sets how many checkpoints the rounds lag behind; `undefined` brings back the game's. */
  setCheckpointLag(checkpointLag: number | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), checkpointLag }));
  }

  /** Shows the countdown to the end of the group being typed, or hides it. */
  setCountdown(countdown: boolean): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), countdown: countdown ? true : undefined }));
  }

  /** Makes the keys solid, in their colors, or see-through. */
  setSolidKeys(solid: boolean): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), keys: solid ? 'solid' : undefined }));
  }

  /** Includes unchecked runs, shown and counted in the player's groups, or leaves them out. */
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

  /** Changes how the main menu looks; `undefined` brings back its own look. */
  setMenu(menu: MenuLook | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), menu }));
  }

  /** Tunes the pattern the phone vibrates in on an event; `undefined` brings back the game's. The others keep theirs. */
  setVibration(vibration: Vibration, pattern: VibrationPattern | undefined): Promise<void> {
    const others = Object.entries(this.tweaks().vibrations ?? {}).filter(
      ([key]) => key !== vibration,
    );
    const vibrations = [
      ...others,
      ...(pattern === undefined ? [] : [[vibration, pattern] as const]),
    ];
    return this.save(
      tweakValues({
        ...this.tweaks(),
        vibrations: vibrations.length === 0 ? undefined : Object.fromEntries(vibrations),
      }),
    );
  }

  /** Picks the sound model the keys are played with; `undefined` brings back the game's. */
  setSoundModel(kind: SoundModelKind | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), soundModel: kind?.id }));
  }

  /** Sets how loud the sounds are and how long they ring; `undefined` brings back the game's mix. */
  setSoundMix(sound: SoundMix | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), sound }));
  }

  /** How long the keypad's keys take to move. */
  readonly keyMotion = computed(
    (): KeyMotion =>
      (this.developerMode.enabled() ? this.tweaks().keyMotion : undefined) ?? KEY_MOTION,
  );

  /** Sets how long the keypad's keys take to move; `undefined` brings back the game's. */
  setKeyMotion(keyMotion: KeyMotion | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), keyMotion }));
  }

  /** Sets how a wrong key's note goes off; `undefined` brings back the game's souring. */
  setSouring(souring: Souring | undefined): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), souring }));
  }

  /** Shows what each key typed played, in words, or hides it. */
  setSoundNotes(soundNotes: boolean): Promise<void> {
    return this.save(tweakValues({ ...this.tweaks(), soundNotes: soundNotes ? true : undefined }));
  }

  /** Brings back the game's own value of everything tuned. */
  reset(): Promise<void> {
    return this.save({});
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
    twilight,
    breakModel,
    grouping,
    pins,
    colorSpace,
    seasonTurn,
    keyLinger,
    breath,
    unavailable,
    otherKeys,
    discoverSpeed,
    paceStep,
    handOver,
    groupPause,
    gameLinger,
    checking,
    countdown,
    manualCheckpoints,
    checkpointLag,
    keys,
    includeUnchecked,
    runOrder,
    layout,
    menu,
    vibrations,
    soundModel,
    sound,
    souring,
    soundNotes,
    keyMotion,
  } = migrate(stored, TWEAKS_MIGRATIONS);
  if (format !== TWEAKS_FORMAT) {
    return {};
  }
  return tweakValues({
    palette: isPalette(palette) ? palette : undefined,
    seasons: isSeasonStarts(seasons) ? seasons : undefined,
    twilight: isColorPair(twilight) ? twilight : undefined,
    breakModel: breakModelKindById(breakModel)?.id,
    grouping: groupingOf(grouping),
    pins: pinsOf(pins),
    colorSpace: isColorSpace(colorSpace) ? colorSpace : undefined,
    seasonTurn: isSeasonTurn(seasonTurn) ? seasonTurn : undefined,
    keyLinger: isKeyLinger(keyLinger) ? keyLinger : undefined,
    breath: isBreath(breath) ? breath : undefined,
    unavailable: isUnavailable(unavailable) ? unavailable : undefined,
    otherKeys: isOtherKeyColors(otherKeys) ? otherKeys : undefined,
    discoverSpeed: isDiscoverSpeed(discoverSpeed) ? discoverSpeed : undefined,
    paceStep: isPaceStep(paceStep) ? paceStep : undefined,
    handOver: isHandOver(handOver) ? handOver : undefined,
    groupPause: isGroupPause(groupPause) ? groupPause : undefined,
    gameLinger: isGameLinger(gameLinger) ? gameLinger : undefined,
    checking: checking === false ? checking : undefined,
    countdown: countdown === true ? countdown : undefined,
    manualCheckpoints: manualCheckpoints === true ? manualCheckpoints : undefined,
    checkpointLag: isCheckpointLag(checkpointLag) ? checkpointLag : undefined,
    keys: keys === 'solid' ? keys : undefined,
    includeUnchecked: includeUnchecked === true ? includeUnchecked : undefined,
    runOrder: runOrderOf(runOrder),
    layout: parseLayout(layout),
    menu: parseMenuLook(menu),
    vibrations: vibrationsOf(vibrations),
    soundModel: soundModelKindById(soundModel)?.id,
    sound: slidValues(sound, MIX_SLIDERS, SOUND_MIX),
    souring: slidValues(souring, SOURING_SLIDERS, SOURING),
    soundNotes: soundNotes === true ? soundNotes : undefined,
    keyMotion: slidValues(keyMotion, KEY_MOTION_SLIDERS, KEY_MOTION),
  });
}

/**
 * Tweaks, leaving out those at the game's own values, whether tuned back to them or since met by them: as tweaks, they'd
 * only keep the game's values from applying once those change.
 */
export function withoutDefaults(values: TweakValues, gameBreakModel: BreakModelKind): TweakValues {
  const {
    palette,
    seasons,
    twilight,
    breakModel,
    grouping,
    colorSpace,
    seasonTurn,
    keyLinger,
    breath,
    unavailable,
    otherKeys,
    discoverSpeed,
    paceStep,
    handOver,
    groupPause,
    gameLinger,
    checkpointLag,
    layout,
    menu,
    vibrations,
    soundModel,
    sound,
    souring,
    keyMotion,
  } = values;
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
    twilight: equal(twilight, TWILIGHT) ? undefined : twilight,
    breakModel: breakModel === gameBreakModel.id ? undefined : breakModel,
    grouping: tuned.length === 0 ? undefined : Object.fromEntries(tuned),
    colorSpace: colorSpace === SEASON_COLOR_SPACE ? undefined : colorSpace,
    seasonTurn: seasonTurn === SEASON_TURN ? undefined : seasonTurn,
    keyLinger: keyLinger === KEY_LINGER ? undefined : keyLinger,
    breath: breath === BREATH ? undefined : breath,
    unavailable: unavailable === UNAVAILABLE ? undefined : unavailable,
    otherKeys: equal(otherKeys, OTHER_KEY_COLORS) ? undefined : otherKeys,
    discoverSpeed: discoverSpeed === DISCOVER_SPEED ? undefined : discoverSpeed,
    paceStep: paceStep === PACE_STEP ? undefined : paceStep,
    handOver: handOver === HAND_OVER ? undefined : handOver,
    groupPause: groupPause === GROUP_PAUSE ? undefined : groupPause,
    gameLinger: gameLinger === GAME_LINGER ? undefined : gameLinger,
    checkpointLag: checkpointLag === CHECKPOINT_LAG ? undefined : checkpointLag,
    layout: equal(layout, LAYOUT) ? undefined : layout,
    menu: equal(menu, MENU_LOOK) ? undefined : menu,
    vibrations: vibrationsOf(vibrations),
    soundModel: soundModel === SOUND_MODEL.id ? undefined : soundModel,
    sound: equal(sound, SOUND_MIX) ? undefined : sound,
    souring: equal(souring, SOURING) ? undefined : souring,
    keyMotion: equal(keyMotion, KEY_MOTION) ? undefined : keyMotion,
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
  twilight,
  breakModel,
  grouping,
  pins,
  colorSpace,
  seasonTurn,
  keyLinger,
  breath,
  unavailable,
  otherKeys,
  discoverSpeed,
  paceStep,
  handOver,
  groupPause,
  gameLinger,
  checking,
  countdown,
  manualCheckpoints,
  checkpointLag,
  keys,
  includeUnchecked,
  runOrder,
  layout,
  menu,
  vibrations,
  soundModel,
  sound,
  souring,
  soundNotes,
  keyMotion,
}: {
  readonly [K in keyof TweakValues]: TweakValues[K] | undefined;
}): TweakValues {
  return {
    ...(palette === undefined ? {} : { palette }),
    ...(seasons === undefined ? {} : { seasons }),
    ...(twilight === undefined ? {} : { twilight }),
    ...(breakModel === undefined ? {} : { breakModel }),
    ...(grouping === undefined ? {} : { grouping }),
    ...(pins === undefined ? {} : { pins }),
    ...(colorSpace === undefined ? {} : { colorSpace }),
    ...(seasonTurn === undefined ? {} : { seasonTurn }),
    ...(keyLinger === undefined ? {} : { keyLinger }),
    ...(breath === undefined ? {} : { breath }),
    ...(unavailable === undefined ? {} : { unavailable }),
    ...(otherKeys === undefined ? {} : { otherKeys }),
    ...(discoverSpeed === undefined ? {} : { discoverSpeed }),
    ...(paceStep === undefined ? {} : { paceStep }),
    ...(handOver === undefined ? {} : { handOver }),
    ...(groupPause === undefined ? {} : { groupPause }),
    ...(gameLinger === undefined ? {} : { gameLinger }),
    ...(checking === undefined ? {} : { checking }),
    ...(countdown === undefined ? {} : { countdown }),
    ...(manualCheckpoints === undefined ? {} : { manualCheckpoints }),
    ...(checkpointLag === undefined ? {} : { checkpointLag }),
    ...(keys === undefined ? {} : { keys }),
    ...(includeUnchecked === undefined ? {} : { includeUnchecked }),
    ...(runOrder === undefined ? {} : { runOrder }),
    ...(layout === undefined ? {} : { layout }),
    ...(menu === undefined ? {} : { menu }),
    ...(vibrations === undefined ? {} : { vibrations }),
    ...(soundModel === undefined ? {} : { soundModel }),
    ...(sound === undefined ? {} : { sound }),
    ...(souring === undefined ? {} : { souring }),
    ...(soundNotes === undefined ? {} : { soundNotes }),
    ...(keyMotion === undefined ? {} : { keyMotion }),
  };
}

/**
 * The vibration patterns tuned, read from untrusted data, leaving out those of no event, those not valid and those at
 * the game's own.
 */
function vibrationsOf(value: unknown): Partial<VibrationPatterns> | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const stored = value as Record<string, unknown>;
  const kept = VIBRATIONS.flatMap((vibration) => {
    const pattern = parsePattern(stored[vibration]);
    return pattern === undefined || equal(pattern, VIBRATION_PATTERNS[vibration])
      ? []
      : [[vibration, pattern] as const];
  });
  return kept.length === 0 ? undefined : Object.fromEntries(kept);
}

/** Values set by sliders, as stored, each missing or out of its slider's range at its default. `undefined` if none is kept. */
function slidValues<T>(
  value: unknown,
  sliders: readonly SoundSlider<T>[],
  defaults: T,
): T | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const stored = value as Record<string, unknown>;
  const kept = sliders.flatMap(({ key, min, max }) => {
    const setting = stored[key];
    return typeof setting === 'number' && setting >= min && setting <= max
      ? [[key, setting] as const]
      : [];
  });
  return kept.length === 0 ? undefined : { ...defaults, ...Object.fromEntries(kept) };
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

/** Whether a value holds a color for each of the other keys, and nothing else. */
function isOtherKeyColors(value: unknown): value is OtherKeyColors {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const colors = value as Record<string, unknown>;
  return (
    Object.keys(colors).length === OTHER_KEYS.length &&
    OTHER_KEYS.every((key) => isColor(colors[key]))
  );
}

function isColorPair(value: unknown): value is BackgroundColors {
  return Array.isArray(value) && value.length === 2 && value.every(isColor);
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
