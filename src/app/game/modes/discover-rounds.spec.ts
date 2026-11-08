import { checkpointsAhead, completeRound, moveTo, newRounds } from './discover-rounds';

describe('Discover rounds', () => {
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
});
