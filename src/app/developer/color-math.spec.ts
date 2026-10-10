import { PALETTE } from '../place-colors/place-colors';
import {
  closestPairs,
  colorDifference,
  contrastWithWhite,
  hexToOklch,
  oklchToHex,
} from './color-math';

describe('color math', () => {
  it('goes to OKLCH and back', () => {
    for (const color of [...PALETTE, '#000000', '#ffffff', '#808080']) {
      expect(oklchToHex(hexToOklch(color))).toBe(color);
    }
  });

  it('gives white no colorfulness, and red its hue', () => {
    expect(hexToOklch('#ffffff')[0]).toBeCloseTo(1, 3);
    expect(hexToOklch('#ffffff')[1]).toBeCloseTo(0, 3);
    expect(hexToOklch('#ff0000')[2]).toBeCloseTo(29.2, 0);
  });

  it('makes colors sRGB cannot show less colorful', () => {
    expect(oklchToHex([0.9, 0.3, 260])).toMatch(/^#[0-9a-f]{6}$/);
    const [lightness, chroma] = hexToOklch(oklchToHex([0.9, 0.3, 260]));
    expect(lightness).toBeCloseTo(0.9, 1);
    expect(chroma).toBeLessThan(0.1);
  });

  it('measures the contrast of white text', () => {
    expect(contrastWithWhite('#000000')).toBeCloseTo(21, 5);
    expect(contrastWithWhite('#ffffff')).toBeCloseTo(1, 5);
  });

  it('measures how different two colors look', () => {
    expect(colorDifference('#de3e2d', '#de3e2d')).toBe(0);
    expect(colorDifference('#000000', '#ffffff')).toBeCloseTo(100, 0);
    expect(colorDifference('#de3e2d', '#ec7c0e')).toBeCloseTo(
      colorDifference('#ec7c0e', '#de3e2d'),
      9,
    );
  });

  it('lists every pair of colors, the closest first', () => {
    const pairs = closestPairs(['#000000', '#ffffff', '#010101']);

    expect(pairs.map(({ first, second }) => [first, second])).toEqual([
      [0, 2],
      [1, 2],
      [0, 1],
    ]);
    expect(closestPairs(PALETTE)).toHaveLength(45);
  });
});
