import { ARIA } from './aria';
import { CHORALE } from './chorale';
import type { SoundModelKind } from './sound-model';

/** The sound models, picked in developer mode: the game's first, then the others, newest first. */
export const SOUND_MODELS: readonly [SoundModelKind, ...SoundModelKind[]] = [CHORALE, ARIA];

/** The sound model the game plays the keys with. */
export const SOUND_MODEL = CHORALE;

/** The sound model of that id, if any. */
export function soundModelKindById(id: unknown): SoundModelKind | undefined {
  return SOUND_MODELS.find((kind) => kind.id === id);
}
