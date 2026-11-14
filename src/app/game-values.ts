import type { SeasonStarts, TweakValues } from './developer-mode/tweaks';
import type { VibrationPatterns } from './feedback/vibrations';
import type { BreakSettings } from './game/grouping/break-models/hyperparameters';
import type { LunaSettings } from './game/grouping/break-models/luna';
import type { MarsSettings } from './game/grouping/break-models/mars';
import type { TerraSettings } from './game/grouping/break-models/terra';
import backup from './game-values.json';

/**
 * The game's own values of all that developer mode tunes, each read by its constant, such as `KEY_LINGER`, where its
 * meaning is documented.
 */
export type GameValues = Required<
  Pick<
    TweakValues,
    | 'palette'
    | 'twilight'
    | 'breakModel'
    | 'colorSpace'
    | 'seasonTurn'
    | 'keyLinger'
    | 'breath'
    | 'unavailable'
    | 'actionKeys'
    | 'discoverySpeed'
    | 'paceStep'
    | 'handOver'
    | 'groupPause'
    | 'gameLinger'
    | 'fastForward'
    | 'virtualOpacity'
    | 'checkpointLag'
    | 'layout'
    | 'menu'
    | 'soundModel'
    | 'sound'
    | 'souring'
    | 'keyMotion'
    | 'turnSwitch'
    | 'discoveryHalo'
  >
> & {
  readonly seasons: SeasonStarts;
  readonly grouping: {
    readonly mars: MarsSettings;
    readonly terra: TerraSettings;
    readonly luna: LunaSettings;
    readonly venus: BreakSettings;
    readonly mercury: BreakSettings;
  };
  readonly vibrations: VibrationPatterns;
};

/**
 * The game's own values, read from `game-values.json`: a backup file holding them alone, in its tweaks setting, as
 * developer mode hands tuned values back, so that `npm run promote -- <backup>` makes a backup's tuned values the
 * game's own. Its tests check them as the tweaks they are.
 */
export const GAME_VALUES = backup.settings.tweaks as unknown as GameValues;
