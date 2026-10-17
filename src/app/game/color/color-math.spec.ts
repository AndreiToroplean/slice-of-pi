import { averageHsl, colorDifference } from './color-math';

describe('color math', () => {
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
