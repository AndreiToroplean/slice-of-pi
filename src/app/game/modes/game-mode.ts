/**
 * The rules a run is played by, picked as it starts: in free play, nothing ends the run, and backspace deletes
 * mistakes; in a challenge, the first mistake ends it, and there's no backspace.
 */
export const GAME_MODES = ['free', 'challenge'] as const;

export type GameMode = (typeof GAME_MODES)[number];

export function isGameMode(value: unknown): value is GameMode {
  return GAME_MODES.some((mode) => mode === value);
}
