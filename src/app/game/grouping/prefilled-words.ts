import type { Group } from './break-models/break-model';
import { sizeOnTrack } from './group-size';

/**
 * The sizes of the words a game shows on the tape up to place `to`, as if the player had typed them: those of `kept`,
 * already on the tape, as far as they go without passing `to`, then the player's groups, as the break model knows them,
 * where it trusts them, and groups of `groupSize` on their track elsewhere (see `sizeOnTrack`). The last word ends at
 * `to`, where the game goes on.
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
    const size = Math.min(to - place, sizeAt(place, groups, groupSize));
    words.push(size);
    place += size;
  }
  return words;
}

/**
 * Where the word holding place `to` starts, as `wordsUpTo` would cut the words, but whole: a game starting from a
 * checkpoint starts there, so that it never splits a group; at `to` itself where a word ends there.
 */
export function groupStart(
  kept: readonly number[],
  to: number,
  groups: readonly Group[],
  groupSize: number,
): number {
  let place = 0;
  for (const size of kept) {
    if (place + size > to) {
      return place;
    }
    place += size;
  }
  while (place < to) {
    const size = sizeAt(place, groups, groupSize);
    if (place + size > to) {
      return place;
    }
    place += size;
  }
  return place;
}

/**
 * How long the word starting at a place is: as the player's group there, if the model trusts it; otherwise as far as the
 * track of groups of the group size, or the next group the model trusts, whichever comes first.
 */
function sizeAt(place: number, groups: readonly Group[], groupSize: number): number {
  const trusted = groups.filter((group) => group.trusted && !group.open);
  const known = trusted.find((group) => place >= group.start && place < group.start + group.size);
  if (known !== undefined) {
    return known.start + known.size - place;
  }
  const next = Math.min(...trusted.map((group) => group.start).filter((start) => start > place));
  return Math.min(sizeOnTrack(place, groupSize), next - place);
}
