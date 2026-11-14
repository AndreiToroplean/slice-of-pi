/**
 * The rules a run is played by, picked as it starts: in free play, nothing ends the run, and backspace deletes
 * mistakes; in a challenge, the first mistake ends it, and there's no backspace; in Discovery, the game plays each
 * round, one more digit each, for the player to retype, and the first mistake ends it too.
 */
export const GAME_MODES = ['free', 'challenge', 'discovery'] as const;

export type GameMode = (typeof GAME_MODES)[number];

export function isGameMode(value: unknown): value is GameMode {
  return GAME_MODES.some((mode) => mode === value);
}
