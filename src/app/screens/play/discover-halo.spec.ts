import { DISCOVER_HALO, parseDiscoverHalo, withHaloLight } from './discover-halo';

describe('parseDiscoverHalo', () => {
  it('keeps a halo’s values in range, the game’s in place of the others', () => {
    expect(
      parseDiscoverHalo({ color: '#123456', light: { ...DISCOVER_HALO.light, core: 4, rays: 7 } }),
    ).toEqual({
      color: '#123456',
      light: { ...DISCOVER_HALO.light, core: 4 },
    });
    expect(parseDiscoverHalo({ color: 'red' })).toEqual(DISCOVER_HALO);
    expect(parseDiscoverHalo('halo')).toBeUndefined();
  });
});

describe('withHaloLight', () => {
  it('sets one value of its light', () => {
    expect(withHaloLight(DISCOVER_HALO, 'reach', 20).light).toEqual({
      ...DISCOVER_HALO.light,
      reach: 20,
    });
  });
});
