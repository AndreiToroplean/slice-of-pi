import type { BreakModelKind } from './break-model';
import { MERCURY } from './mercury';

/** The break models, picked in developer mode: the first is the game's. */
export const BREAK_MODELS: readonly [BreakModelKind, ...BreakModelKind[]] = [MERCURY];

/** The break model the game takes the groups from. */
export const BREAK_MODEL = BREAK_MODELS[0];

/** The break model of that name, if any. */
export function breakModelNamed(name: unknown): BreakModelKind | undefined {
  return BREAK_MODELS.find((model) => model.name === name);
}
