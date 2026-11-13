import { turnShadeShown } from './turn-shade';

describe('turnShadeShown', () => {
  it('shows all of the shade on the game’s turn, and none on the player’s', () => {
    expect(turnShadeShown('game')).toBe(1);
    expect(turnShadeShown('player')).toBe(0);
  });

  it('takes it out steadily as the game hands its turn over, and brings it in as the player hands theirs over', () => {
    expect([1, 0.75, 0].map((left) => turnShadeShown('game', left))).toEqual([1, 0.75, 0]);
    expect([1, 0.75, 0].map((left) => turnShadeShown('player', left))).toEqual([0, 0.25, 1]);
  });
});
