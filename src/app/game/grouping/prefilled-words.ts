import type { Group } from './break-models/break-model';

/**
 * The sizes of the words a game shows on the tape up to place `to`, as if the player had typed them: those of `kept`,
 * already on the tape, as far as they go without passing `to`, then the player's groups, as the break model knows them,
 * where it trusts them, and groups of `groupSize` elsewhere. The last word ends at `to`, where the game goes on.
 */
export function wordsUpTo(
  kept: readonly number[],
  to: number,
  groups: readonly Group[],
  groupSize: number,
): number[] {
  const words: number[] = [];
  let place = 0;
  for (const size of kept) {
    if (place + size > to) {
      break;
    }
    words.push(size);
    place += size;
  }
  while (place < to) {
    const known = groups.find(
      (group) =>
        group.trusted && !group.open && place >= group.start && place < group.start + group.size,
    );
    const size = Math.min(
      to - place,
      known === undefined ? groupSize : known.start + known.size - place,
    );
    words.push(size);
    place += size;
  }
  return words;
}
