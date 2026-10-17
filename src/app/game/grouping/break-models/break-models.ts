import type { BreakModelKind } from './break-model';
import { MERCURY } from './mercury';
import { VENUS } from './venus';

/** The break models, picked in developer mode: the first is the game's. */
export const BREAK_MODELS: readonly [BreakModelKind, ...BreakModelKind[]] = [MERCURY, VENUS];

/** The break model the game takes the groups from. */
export const BREAK_MODEL = BREAK_MODELS[0];

/** The break model of that id, if any. */
export function breakModelKindById(id: unknown): BreakModelKind | undefined {
  return BREAK_MODELS.find((kind) => kind.id === id);
}
