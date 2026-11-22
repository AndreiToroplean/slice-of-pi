import {
  climbTime,
  FIRST_MILESTONE_WAVE,
  MILESTONE_WAVE,
  MilestoneWave,
  RISE,
  waveLifetime,
  waveValue,
} from './milestone-wave';

describe('milestone waves', () => {
  const wave: MilestoneWave = {
    ...FIRST_MILESTONE_WAVE,
    frequency: 1,
    duration: 3,
    decay: 1,
    peak: 1,
    speed: 0.5,
    acceleration: 2,
  };

  it('climb faster and faster', () => {
    expect(climbTime(wave, 0)).toBe(0);
    // Half a screen a second, sped up by 2 each second: a screen in 0.78 s.
    expect(climbTime(wave, 1)).toBeCloseTo((-0.5 + Math.sqrt(0.25 + 4)) / 2);
    expect(climbTime(wave, 1) - climbTime(wave, 0.5)).toBeLessThan(climbTime(wave, 0.5));
    expect(climbTime({ ...wave, acceleration: 0 }, 1)).toBe(2);
  });

  it('the first time, crest at once at their strongest, fading out to nothing', () => {
    expect(waveValue(wave, true, 0)).toBe(0);
    expect(waveValue(wave, true, RISE)).toBeCloseTo((1 - RISE / 3) * Math.cos(2 * Math.PI * RISE));
    const crests = [1, 2].map((s) => waveValue(wave, true, s));
    expect(crests[0]).toBeCloseTo(2 / 3);
    expect(crests[1]).toBeCloseTo(1 / 3);
    // Half a period on, a trough, tipping the hue the other way.
    expect(waveValue(wave, true, 1.5)).toBeCloseTo(-0.5);
    expect(waveValue(wave, true, 3)).toBeCloseTo(0);
    expect(waveValue(wave, true, -0.1)).toBe(0);
    expect(waveValue(wave, true, 3.1)).toBe(0);
  });

  it('every other time, pulse once, cresting halfway', () => {
    const pulse = { ...wave, duration: 0.4, peak: 0.5 };
    expect(waveValue(pulse, false, 0.2)).toBeCloseTo(0.5);
    expect(waveValue(pulse, false, 0)).toBeCloseTo(0);
    expect(waveValue(pulse, false, 0.4)).toBeCloseTo(0);
    expect(Math.abs(waveValue(pulse, false, 0.1))).toBeLessThan(0.5);
  });

  it('last until their end has climbed to the top', () => {
    expect(waveLifetime(wave)).toBeCloseTo(3 + climbTime(wave, 1));
    expect(waveLifetime(MILESTONE_WAVE)).toBeLessThan(waveLifetime(FIRST_MILESTONE_WAVE));
  });
});
