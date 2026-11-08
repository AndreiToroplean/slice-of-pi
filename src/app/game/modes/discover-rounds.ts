import { isCheckpoint } from './checkpoints';

/**
 * Where a Discover session is, round after round, as in the classic memory game: each round, the game plays the
 * digits from the place the rounds start from up to one more group than the player has retyped, as the play screen
 * groups them, and the player retypes them all, one more group each round. The rounds start from the place the session started from until the player moves them
 * on to a checkpoint they've reached, never back.
 */
export interface Rounds {
  /** The place the session started from, that of its first digit: the start of π, or that of a checkpoint's group. */
  readonly start: number;
  /** The checkpoint the rounds start at: that the session started at, or one reached since, the start of π at first. */
  readonly checkpoint: number;
  /** The place the rounds start from: that of the checkpoint's group, so that they never split a group. */
  readonly from: number;
  /** The place reached: that of the digit after the last one the player has retyped. */
  readonly reached: number;
}

/** A session starting from a place, that of a checkpoint's group, before its first round. */
export function newRounds(start: number, checkpoint = start): Rounds {
  return { start, checkpoint, from: start, reached: start };
}

/** Where the session is once the player has retyped a whole round, reaching the place after its last digit. */
export function completeRound(rounds: Rounds, reached: number): Rounds {
  return { ...rounds, reached: Math.max(rounds.reached, reached) };
}

/** The checkpoints reached since the one the rounds start at, which they can move on to, in order. */
export function checkpointsAhead(rounds: Rounds): number[] {
  const { checkpoint, reached } = rounds;
  return Array.from(
    { length: Math.max(0, reached - checkpoint) },
    (_, i) => checkpoint + i + 1,
  ).filter(isCheckpoint);
}

/**
 * Where the session is once its rounds start at a checkpoint ahead, if it's one, from `from`, the place its group starts;
 * never back.
 */
export function moveTo(rounds: Rounds, checkpoint: number, from = checkpoint): Rounds {
  return checkpointsAhead(rounds).includes(checkpoint)
    ? { ...rounds, checkpoint, from: Math.max(rounds.from, from) }
    : rounds;
}
