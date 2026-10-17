import { PALETTE } from '../layers/place-colors';
import {
  COLOR_SPACES,
  hexToHsl,
  hslToHex,
  hueOf,
  mix,
  mixGradients,
  shortWay,
} from './color-spaces';

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

  it('turns hues the long way round when told to', () => {
    // Red to magenta the long way goes through green.
    expect(hexToHsl(mix('#ff0000', '#ff00ff', 0.5, 'hsl', 'long')).hue).toBeCloseTo(150, 0);
    expect(mix('#ff0000', '#ff00ff', 0.5, 'srgb', 'long')).toBe(mix('#ff0000', '#ff00ff', 0.5));
  });
});

describe('shortWay', () => {
  it('turns from one hue to another the short way round, either way', () => {
    expect(shortWay(10, 50)).toBe(40);
    expect(shortWay(50, 10)).toBe(-40);
    expect(shortWay(350, 10)).toBe(20);
    expect(shortWay(10, 350)).toBe(-20);
    expect(shortWay(0, 180)).toBe(180);
  });
});

describe('mixGradients', () => {
  // Late winter's blues, top and bottom, and spring's pink top and green bottom.
  const winter = ['#8299c9', '#30406f'] as const;
  const spring = ['#ffb3d1', '#7fd6a6'] as const;

  it('gives the first gradient at 0 and the second at 1, in every space', () => {
    for (const space of COLOR_SPACES) {
      expect(mixGradients(winter, spring, 0, space)).toEqual(winter);
      expect(mixGradients(winter, spring, 1, space)).toEqual(spring);
    }
  });

  it('blends the starts and the ends as mix does, in spaces without a hue', () => {
    for (const space of ['srgb', 'oklab'] as const) {
      expect(mixGradients(winter, spring, 0.3, space)).toEqual([
        mix(winter[0], spring[0], 0.3, space),
        mix(winter[1], spring[1], 0.3, space),
      ]);
    }
  });

  it('turns the start and the end the same way, so the gradient never flips', () => {
    for (const space of ['hsl', 'oklch'] as const) {
      const turns = Array.from({ length: 21 }, (_, step) => {
        const [start, end] = mixGradients(winter, spring, step / 20, space);
        return shortWay(hueOf(start, space), hueOf(end, space));
      });
      for (const [step, turn] of turns.entries()) {
        expect(Math.abs(turn - (turns[step + 1] ?? turn))).toBeLessThan(45);
      }
    }
    // Blended on its own, the end would turn from blue back to green, against the start, and the gradient would flip.
    const end = mixGradients(winter, spring, 0.25, 'oklch')[1];
    expect(shortWay(hueOf(winter[1], 'oklch'), hueOf(end, 'oklch'))).toBeGreaterThan(0);
  });

  it('makes the shorter trip overall, turning the start or the end the long way', () => {
    const hsl = (hue: number): string => hslToHex({ hue, saturation: 100, lightness: 50 });
    // From 150 degrees apart to 140 the other way: the start turns 20 degrees back and the end 310, rather than the
    // end 50 degrees on and the start 340.
    const [start, end] = mixGradients([hsl(0), hsl(150)], [hsl(340), hsl(200)], 0.5, 'hsl');
    expect(hueOf(start, 'hsl')).toBeCloseTo(350, -1);
    expect(hueOf(end, 'hsl')).toBeCloseTo(355, -1);
  });
});
