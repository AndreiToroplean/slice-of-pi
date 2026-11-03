import { ARIA } from './aria';
import { CHORALE } from './chorale';
import type { SoundModelKind } from './sound-model';

/** The sound models, picked in developer mode. */
export const SOUND_MODELS: readonly [SoundModelKind, ...SoundModelKind[]] = [ARIA, CHORALE];

/** The sound model the game plays the keys with. */
export const SOUND_MODEL = ARIA;

/** The sound model of that id, if any. */
export function soundModelKindById(id: unknown): SoundModelKind | undefined {
  return SOUND_MODELS.find((kind) => kind.id === id);
}
