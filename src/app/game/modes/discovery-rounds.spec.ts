import {
  checkpointsAhead,
  completeRound,
  isCheckpointLag,
  laggingCheckpoint,
  MAX_CHECKPOINT_LAG,
  moveTo,
  newRounds,
} from './discovery-rounds';

describe('Discovery rounds', () => {
  it('reaches the place after the round retyped, never back', () => {
    const rounds = completeRound(newRounds(0), 5);

    expect(rounds.reached).toBe(5);
    expect(completeRound(rounds, 3).reached).toBe(5);
  });

  it('offers the checkpoints reached to start the rounds from, moving on but never back', () => {
    const rounds = completeRound(newRounds(0), 23);
    expect(checkpointsAhead(rounds)).toEqual([10, 20]);

    const moved = moveTo(rounds, 20);
    expect(moved.from).toBe(20);
    expect(checkpointsAhead(moved)).toEqual([]);
    expect(moveTo(moved, 10)).toBe(moved);
    expect(moveTo(rounds, 30)).toBe(rounds);
  });

  it('starts the rounds at a checkpoint from where its group starts, never offering it again', () => {
    const moved = moveTo(completeRound(newRounds(0), 23), 20, 18);

    expect(moved.from).toBe(18);
    expect(moved.checkpoint).toBe(20);
    expect(checkpointsAhead(moved)).toEqual([]);
    expect(checkpointsAhead(completeRound(newRounds(198, 200), 215))).toEqual([210]);
  });

  it('moves on by itself to the checkpoint so many behind the farthest reached, once it is ahead', () => {
    const rounds = completeRound(newRounds(0), 43);

    expect(laggingCheckpoint(rounds, 0)).toBe(40);
    expect(laggingCheckpoint(rounds, 1)).toBe(30);
    expect(laggingCheckpoint(rounds, 3)).toBe(10);
    // Not yet: the rounds start at the start of π until a fifth checkpoint is reached.
    expect(laggingCheckpoint(rounds, 4)).toBeUndefined();
    // Nor back: the rounds start at 30 already.
    expect(laggingCheckpoint(moveTo(rounds, 30), 1)).toBeUndefined();
    expect(laggingCheckpoint(moveTo(rounds, 30), 0)).toBe(40);
  });

  it('lags by whole checkpoints, from none to the most', () => {
    expect([0, 3, MAX_CHECKPOINT_LAG].every(isCheckpointLag)).toBe(true);
    expect([-1, 1.5, MAX_CHECKPOINT_LAG + 1, '3'].some(isCheckpointLag)).toBe(false);
  });
});
