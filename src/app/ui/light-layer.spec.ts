import { glowColor } from './light-layer';

describe('glowColor', () => {
  it('keeps a color as it is at a saturation of 1', () => {
    expect(glowColor('#3371fa', 1).map((c) => Math.round(c * 255))).toEqual([0x33, 0x71, 0xfa]);
  });

  it('pushes a color further from its gray, within what a screen shows', () => {
    const gray = (0xbf + 0x56 + 0xc1) / 3;
    const [r, g, b] = glowColor('#bf56c1', 2);

    expect(r * 255).toBeCloseTo(gray + (0xbf - gray) * 2);
    expect(g * 255).toBeCloseTo(gray + (0x56 - gray) * 2);
    expect(b * 255).toBeCloseTo(gray + (0xc1 - gray) * 2);
    expect(glowColor('#ff0000', 3)).toEqual([1, 0, 0]);
  });

  it('leaves grays as they are', () => {
    expect(glowColor('#808080', 2.5)).toEqual([128 / 255, 128 / 255, 128 / 255]);
  });
});
