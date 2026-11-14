import { DISCOVERY_HALO, parseDiscoveryHalo, withHaloLight } from './discovery-halo';

describe('parseDiscoveryHalo', () => {
  it('keeps a halo’s values in range, the game’s in place of the others', () => {
    expect(
      parseDiscoveryHalo({
        color: '#123456',
        light: { ...DISCOVERY_HALO.light, core: 4, rays: 7 },
      }),
    ).toEqual({
      color: '#123456',
      light: { ...DISCOVERY_HALO.light, core: 4 },
    });
    expect(parseDiscoveryHalo({ color: 'red' })).toEqual(DISCOVERY_HALO);
    expect(parseDiscoveryHalo('halo')).toBeUndefined();
  });
});

describe('withHaloLight', () => {
  it('sets one value of its light', () => {
    expect(withHaloLight(DISCOVERY_HALO, 'reach', 20).light).toEqual({
      ...DISCOVERY_HALO.light,
      reach: 20,
    });
  });
});
