import { PALETTE } from '../place-colors/place-colors';
import { COLOR_SPACES, hexToHsl, hslToHex, mix } from './color-spaces';

describe('HSL', () => {
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
});

describe('mix', () => {
  it('gives the first color at 0 and the second at 1, in every space', () => {
    for (const space of COLOR_SPACES) {
      expect(mix('#ffc35a', '#38b6ea', 0, space)).toBe('#ffc35a');
      expect(mix('#ffc35a', '#38b6ea', 1, space)).toBe('#38b6ea');
    }
  });

  it('blends in sRGB by default, channel by channel', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#ff0010', '#00ff10', 0.25)).toBe('#bf4010');
  });

  it('keeps blends of black and white grey, halfway in lightness as it looks in OKLab', () => {
    for (const space of COLOR_SPACES) {
      expect(hexToHsl(mix('#000000', '#ffffff', 0.5, space)).saturation).toBeCloseTo(0);
    }
    expect(mix('#000000', '#ffffff', 0.5, 'oklab')).toBe('#636363');
  });

  it('meets in grey in sRGB and OKLab, but keeps colors saturated turning the hue in HSL and OKLCH', () => {
    const saturation = (space: (typeof COLOR_SPACES)[number]): number =>
      hexToHsl(mix('#ffc35a', '#38b6ea', 0.5, space)).saturation;

    expect(saturation('srgb')).toBeLessThan(25);
    expect(saturation('oklab')).toBeLessThan(25);
    expect(saturation('hsl')).toBeGreaterThan(80);
    expect(saturation('oklch')).toBeGreaterThan(50);
  });

  it('turns hues the short way round', () => {
    // Red to magenta goes through pink, not through green.
    const { hue } = hexToHsl(mix('#ff0000', '#ff00ff', 0.5, 'hsl'));
    expect(hue).toBeCloseTo(330, 0);
    const oklch = hexToHsl(mix('#ff0000', '#ff00ff', 0.5, 'oklch')).hue;
    expect(oklch > 300 || oklch < 30).toBe(true);
  });
});
