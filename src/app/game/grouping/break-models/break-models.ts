import { InjectionToken } from '@angular/core';
import type { BreakModelKind, Settings } from './break-model';
import { GROUPS_OF_FIVE_FLAG } from './groups-of-five-flag';
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

/** Mars's group-size envelope ruling out every size but 5. */
const ONLY_FIVES: Settings = {
  envelopeStrength: 1,
  envelopeSize1: 4,
  envelopeFactor1: 0,
  envelopeSize2: 5,
  envelopeFactor2: 1,
  envelopeSize3: 6,
  envelopeFactor3: 0,
  envelopeSize4: 7,
  envelopeFactor4: 0,
};

/**
 * Mars playing groups of 5 alone, wherever the runs break, whatever it's tuned to: for tests that play the game without
 * being about how it finds the groups, so that tuning the game's model leaves them as they are.
 */
export const GROUPS_OF_FIVE: BreakModelKind = {
  ...MARS,
  defaults: { ...MARS.defaults, ...ONLY_FIVES },
  create: (tuned) => MARS.create({ ...tuned, ...ONLY_FIVES }),
};

/**
 * The break model the game takes the groups from, as the game reads it: {@link BREAK_MODEL}, but tests of the screens
 * name the model they're written for, so that changing the game's model leaves what they test as it is, and end-to-end
 * tests play groups of 5 unless they're about the game's model.
 */
export const GAME_BREAK_MODEL = new InjectionToken<BreakModelKind>('GAME_BREAK_MODEL', {
  factory: () =>
    (globalThis as Record<string, unknown>)[GROUPS_OF_FIVE_FLAG] === true
      ? GROUPS_OF_FIVE
      : BREAK_MODEL,
});

/** The break model of that id, if any. */
export function breakModelKindById(id: unknown): BreakModelKind | undefined {
  return BREAK_MODELS.find((kind) => kind.id === id);
}
