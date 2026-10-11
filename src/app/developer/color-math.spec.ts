import { PALETTE } from '../place-colors/place-colors';
import { colorDifference, averageHsl, hexToHsl, hslToHex } from './color-math';

describe('color math', () => {
  it('goes to HSL and back', () => {
    for (const color of [...PALETTE, '#000000', '#ffffff', '#808080', '#ff0000']) {
      expect(hslToHex(hexToHsl(color))).toBe(color);
    }
  });

  it('starts hues on red, then yellow, green, cyan, blue and magenta', () => {
    expect(
      ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'].map(
        (color) => hexToHsl(color).hue,
      ),
    ).toEqual([0, 60, 120, 180, 240, 300]);
    expect(hexToHsl('#ff0000')).toEqual({ hue: 0, saturation: 100, lightness: 50 });
    expect(hexToHsl('#808080')).toMatchObject({ hue: 0, saturation: 0 });
    expect(hslToHex({ hue: 120, saturation: 100, lightness: 25 })).toBe('#008000');
  });

  it('averages two colors, hues the short way round', () => {
    expect(
      averageHsl(
        { hue: 350, saturation: 80, lightness: 40 },
        { hue: 30, saturation: 60, lightness: 60 },
      ),
    ).toEqual({ hue: 10, saturation: 70, lightness: 50 });
    expect(
      averageHsl(
        { hue: 100, saturation: 0, lightness: 0 },
        { hue: 200, saturation: 100, lightness: 100 },
      ),
    ).toEqual({ hue: 150, saturation: 50, lightness: 50 });
  });

  it('measures how different two colors look', () => {
    expect(colorDifference('#de3e2d', '#de3e2d')).toBe(0);
    expect(colorDifference('#000000', '#ffffff')).toBeCloseTo(100, 0);
    expect(colorDifference('#de3e2d', '#ec7c0e')).toBeCloseTo(
      colorDifference('#ec7c0e', '#de3e2d'),
      9,
    );
  });
});
