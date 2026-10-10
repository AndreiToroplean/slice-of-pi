import {
  FLIGHT_DURATION,
  FLIGHT_STAGGER,
  flightKeyframes,
  flightTiming,
  tileCorners,
} from './flight';

describe('tileCorners', () => {
  it('rounds only the outer corners of a word', () => {
    expect(tileCorners(0, 3, 4)).toEqual([4, 0, 0, 4]);
    expect(tileCorners(1, 3, 4)).toEqual([0, 0, 0, 0]);
    expect(tileCorners(2, 3, 4)).toEqual([0, 4, 4, 0]);
  });

  it('rounds every corner of a word of one digit', () => {
    expect(tileCorners(0, 1, 4)).toEqual([4, 4, 4, 4]);
  });
});

describe('flightKeyframes', () => {
  const slot = { left: 100, top: 500, width: 40, height: 60 };
  const tile = { left: 20, top: 100, width: 20, height: 24 };

  it('starts on the slot, with its radius', () => {
    expect(flightKeyframes(slot, tile, 14, [0, 0, 0, 0])[0]).toEqual({
      transform: 'none',
      borderRadius: '14px',
    });
  });

  it('lands centered on the tile, scaled to its size', () => {
    const [, end] = flightKeyframes(slot, tile, 14, [0, 0, 0, 0]);

    // Centers: the slot's at (120, 530), the tile's at (30, 112).
    expect(end?.['transform']).toBe('translate(-90px, -418px) scale(0.5, 0.4)');
  });

  it("lands with the tile's corners, undoing the scale", () => {
    const [, end] = flightKeyframes(slot, tile, 14, [4, 0, 0, 4]);

    expect(end?.['borderRadius']).toBe('8px 0px 0px 8px / 10px 0px 0px 10px');
  });
});

describe('flightTiming', () => {
  it('lets each slot leave a little after the one before it', () => {
    expect(flightTiming(0)).toMatchObject({
      duration: FLIGHT_DURATION,
      delay: 0,
      fill: 'both',
    });
    expect(flightTiming(3).delay).toBe(3 * FLIGHT_STAGGER);
  });

  it('stops staggering after 12 slots, so long groups land together', () => {
    expect(flightTiming(12).delay).toBe(12 * FLIGHT_STAGGER);
    expect(flightTiming(30).delay).toBe(12 * FLIGHT_STAGGER);
  });
});
