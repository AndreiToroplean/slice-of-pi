import { InjectionToken } from '@angular/core';
import type { BreakModelKind } from './break-model';
import { LUNA } from './luna';
import { MARS } from './mars';
import { MERCURY } from './mercury';
import { TERRA } from './terra';
import { VENUS } from './venus';
import { GAME_VALUES } from '../../../game-values';

/** The break models, picked in developer mode: the game's first, then the others, newest first. */
export const BREAK_MODELS: readonly [BreakModelKind, ...BreakModelKind[]] = [
  MARS,
  TERRA,
  LUNA,
  VENUS,
  MERCURY,
];

/** The break model the game takes the groups from. */
export const BREAK_MODEL = breakModelKindById(GAME_VALUES.breakModel) ?? MARS;

/**
 * The break model the game takes the groups from, as the game reads it: {@link BREAK_MODEL}, but tests of the screens
 * name the model they're written for, so that changing the game's model leaves what they test as it is.
 */
export const GAME_BREAK_MODEL = new InjectionToken<BreakModelKind>('GAME_BREAK_MODEL', {
  factory: () => BREAK_MODEL,
});

/** The break model of that id, if any. */
export function breakModelKindById(id: unknown): BreakModelKind | undefined {
  return BREAK_MODELS.find((kind) => kind.id === id);
}
