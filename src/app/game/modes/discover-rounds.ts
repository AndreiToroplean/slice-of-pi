import { isCheckpoint } from './checkpoints';

/**
 * Where a Discover session is, round after round, as in the classic memory game: each round, the game plays the
 * digits from the place the rounds start from up to one more group than the player has retyped, as the play screen
 * groups them, and the player retypes them all, one more group each round. The rounds start from the place the session started from until the player moves them
 * on to a checkpoint they've reached, never back.
 */
export interface Rounds {
  /** The place the session started from, that of its first digit: the start of π, or a checkpoint. */
  readonly start: number;
  /** The place the rounds start from: the session's start, or a checkpoint reached since. */
  readonly from: number;
  /** The place reached: that of the digit after the last one the player has retyped. */
  readonly reached: number;
}

/** A session starting from a place, before its first round. */
export function newRounds(start: number): Rounds {
  return { start, from: start, reached: start };
}

/** Where the session is once the player has retyped a whole round, reaching the place after its last digit. */
export function completeRound(rounds: Rounds, reached: number): Rounds {
  return { ...rounds, reached: Math.max(rounds.reached, reached) };
}

/** The checkpoints reached since the place the rounds start from, which they can move on to, in order. */
export function checkpointsAhead(rounds: Rounds): number[] {
  return Array.from({ length: rounds.reached - rounds.from }, (_, i) => rounds.from + i + 1).filter(
    isCheckpoint,
  );
}

/** Where the session is once its rounds start from a checkpoint ahead, if it's one; never back. */
export function moveTo(rounds: Rounds, checkpoint: number): Rounds {
  return checkpointsAhead(rounds).includes(checkpoint) ? { ...rounds, from: checkpoint } : rounds;
}
