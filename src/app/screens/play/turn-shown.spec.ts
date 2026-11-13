import { gameTurnShare, switchedShare } from './turn-shown';

describe('gameTurnShare', () => {
  it('shows all of the game’s turn on its turn, and none on the player’s', () => {
    expect(gameTurnShare('game')).toBe(1);
    expect(gameTurnShare('player')).toBe(0);
  });

  it('takes it away steadily as the game hands its turn over, and brings it as the player hands theirs over', () => {
    expect([1, 0.75, 0].map((left) => gameTurnShare('game', left))).toEqual([1, 0.75, 0]);
    expect([1, 0.75, 0].map((left) => gameTurnShare('player', left))).toEqual([0, 0.25, 1]);
  });
});

describe('switchedShare', () => {
  it('goes steadily from where it was to where it goes over the switch, and stays there', () => {
    expect([0, 150, 300, 600].map((elapsed) => switchedShare(0.8, 0, elapsed, 300))).toEqual([
      0.8, 0.4, 0, 0,
    ]);
  });

  it('gets there at once without a switch time', () => {
    expect(switchedShare(0.8, 1, 0, 0)).toBe(1);
  });
});
