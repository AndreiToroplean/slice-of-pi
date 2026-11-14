/**
 * Checkpoints are round places a game can start from, rather than from the start of π: every 10 places, once the
 * player has shown they know π that far. Discovery's rounds move on to them too. Place 0, where π starts, is no
 * checkpoint: it's where every game starts otherwise.
 */
export const CHECKPOINTS = 10;

/** The checkpoints a run reaching each of these places unlocks, in order: every one up to the farthest. */
export function unlockedCheckpoints(reached: readonly number[]): number[] {
  const farthest = Math.max(0, ...reached);
  return Array.from(
    { length: Math.floor(farthest / CHECKPOINTS) },
    (_, i) => (i + 1) * CHECKPOINTS,
  );
}

/** Whether a place is a checkpoint, place 0 aside. */
export function isCheckpoint(place: number): boolean {
  return place > 0 && place % CHECKPOINTS === 0;
}
