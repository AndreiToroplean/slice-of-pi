import { GAME_BREAK_MODEL } from '../app/game/grouping/break-models/break-models';
import { MERCURY } from '../app/game/grouping/break-models/mercury';

/** Plays with Mercury, which the tests of the screens are written for, whichever is the game's break model. */
export const PLAY_WITH_MERCURY = { provide: GAME_BREAK_MODEL, useValue: MERCURY };
