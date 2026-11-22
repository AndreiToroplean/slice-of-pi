import { FIRST_MILESTONE_WAVE, MilestoneWave } from './milestone-wave';
import { displacementMap, screenBend } from './screen-bend';

describe('the screen bent by a milestone wave', () => {
  const wave: MilestoneWave = {
    ...FIRST_MILESTONE_WAVE,
    frequency: 1,
    duration: 3,
    decay: 1,
    speed: 1,
    acceleration: 0,
    depth: 0.25,
    falloff: 1,
    distortion: 0.1,
    colorSplit: 0.01,
  };

  it('bends the edges inward as the wave climbs past them, never the middle', () => {
    // A wave cresting at the bottom: its first crest, a second in, a screen high.
    const bend = screenBend(wave, true, 0.25, 100, 200, 10, 20);
    const at = (column: number, row: number): number => row * 10 + column;
    // The bottom left corner shows the screen from up and to the right of it, its middle from where it is.
    expect(bend.x[at(0, 19)]).toBeGreaterThan(0);
    expect(bend.y[at(0, 19)]).toBeLessThan(0);
    expect(bend.x[at(5, 10)]).toBe(0);
    expect(bend.y[at(5, 10)]).toBe(0);
    // Not reached yet at the top.
    expect(bend.x[at(0, 0)]).toBe(0);
    expect(bend.reach).toBeGreaterThan(0);
  });

  it('encodes each point as far as it goes, its colors split either way', () => {
    const bend = {
      x: Float32Array.of(5),
      y: Float32Array.of(-5),
      splitX: Float32Array.of(1),
      splitY: Float32Array.of(0),
      reach: 6,
    };

    expect(Array.from(displacementMap(bend, 0, 20))).toEqual([191, 64, 128, 255]);
    expect(displacementMap(bend, 1, 20)[0]).toBe(204);
    expect(displacementMap(bend, -1, 20)[0]).toBe(179);
  });
});
