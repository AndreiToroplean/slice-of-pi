import { isCheckpoint, unlockedCheckpoints } from './checkpoints';

describe('checkpoints', () => {
  it('unlocks every checkpoint, every 10 places, up to the farthest place reached', () => {
    expect(unlockedCheckpoints([])).toEqual([]);
    expect(unlockedCheckpoints([9, 4])).toEqual([]);
    expect(unlockedCheckpoints([10])).toEqual([10]);
    expect(unlockedCheckpoints([12, 35, 21])).toEqual([10, 20, 30]);
  });

  it('places a checkpoint every 10 places, place 0 being none', () => {
    expect([isCheckpoint(0), isCheckpoint(10), isCheckpoint(15), isCheckpoint(50)]).toEqual([
      false,
      true,
      false,
      true,
    ]);
  });
});
