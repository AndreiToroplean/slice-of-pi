import { Digit } from '../digit';

/** A typed digit and its position in the whole typed sequence (0-based). */
export interface TapeEntry {
  readonly position: number;
  readonly digit: Digit;
}

/**
 * The digits typed so far. Only the most recent entries are kept, so memory and DOM size stay bounded however many
 * digits are typed; `count` still tracks the whole sequence.
 */
export interface Tape {
  readonly count: number;
  readonly recent: readonly TapeEntry[];
}

export const EMPTY_TAPE: Tape = { count: 0, recent: [] };

/** Returns a new tape with `digit` appended, keeping at most `capacity` recent entries. */
export function appendDigit(tape: Tape, digit: Digit, capacity: number): Tape {
  const entry: TapeEntry = { position: tape.count, digit };
  return {
    count: tape.count + 1,
    recent: [...tape.recent, entry].slice(-capacity),
  };
}
