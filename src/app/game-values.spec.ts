import { parseTweaks, TWEAKS_FORMAT } from './developer-mode/tweaks';
import { parsePattern, VIBRATIONS } from './feedback/vibrations';
import { BREAK_MODELS } from './game/grouping/break-models/break-models';
import { GAME_VALUES, GameValues } from './game-values';
import backup from './game-values.json';

describe('GAME_VALUES', () => {
  it('are tweaks in the current format, every one valid', () => {
    // Vibrations at the game's own patterns are left out as tweaks: they're checked one by one.
    const { format, vibrations, ...values } = backup.settings.tweaks;
    expect(format).toBe(TWEAKS_FORMAT);
    expect(parseTweaks(backup.settings.tweaks)).toEqual(values);
    for (const vibration of VIBRATIONS) {
      expect(parsePattern(vibrations[vibration])).toEqual(vibrations[vibration]);
    }
  });

  it('hold every value developer mode tunes, and every break model’s', () => {
    const keys: Readonly<Record<keyof GameValues, true>> = {
      palette: true,
      seasons: true,
      twilight: true,
      breakModel: true,
      grouping: true,
      colorSpace: true,
      seasonTurn: true,
      keyLinger: true,
      breath: true,
      unavailable: true,
      otherKeys: true,
      discoverSpeed: true,
      paceStep: true,
      handOver: true,
      groupPause: true,
      gameLinger: true,
      fastForward: true,
      faintOpacity: true,
      checkpointLag: true,
      layout: true,
      menu: true,
      vibrations: true,
      soundModel: true,
      sound: true,
      souring: true,
      keyMotion: true,
    };
    expect(Object.keys(GAME_VALUES).sort()).toEqual(['format', ...Object.keys(keys)].sort());
    expect(Object.keys(GAME_VALUES.grouping).sort()).toEqual(
      BREAK_MODELS.map((kind) => kind.id).sort(),
    );
  });
});
