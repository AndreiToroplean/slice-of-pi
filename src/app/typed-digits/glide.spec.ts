import { Glide, glideAt, glideEnd, glideTo } from './glide';

describe('glideAt', () => {
  const glide: Glide = { from: -300, speed: 0, to: 0, start: 1000, duration: 400 };

  it('starts where it starts, at its start speed', () => {
    expect(glideAt(glide, 1000)).toEqual({ position: -300, speed: 0 });
    expect(glideAt({ ...glide, speed: 2 }, 1000).speed).toBeCloseTo(2);
  });

  it('ends at its target, at rest, and stays there', () => {
    expect(glideAt(glide, 1400)).toEqual({ position: 0, speed: 0 });
    expect(glideAt(glide, 5000)).toEqual({ position: 0, speed: 0 });
  });

  it('moves steadily towards its target', () => {
    const positions = [1100, 1200, 1300].map((time) => glideAt(glide, time).position);

    expect(positions[1]).toBeCloseTo(-150);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(glideAt(glide, 1200).speed).toBeGreaterThan(0);
  });

  it('is at its target at once when it takes no time', () => {
    expect(glideAt({ ...glide, duration: 0 }, 1000)).toEqual({ position: 0, speed: 0 });
  });
});

describe('glideTo', () => {
  it('starts from rest with nothing going on', () => {
    expect(glideTo(null, -300, 0, 1000, 400)).toEqual({
      from: -300,
      speed: 0,
      to: 0,
      start: 1000,
      duration: 400,
    });
  });

  it('starts from rest once the last glide is over', () => {
    const last = glideTo(null, -300, 0, 0, 400);

    expect(glideTo(last, 0, 0, 1000, 400)).toMatchObject({ start: 1000, duration: 400 });
  });

  it('picks up smoothly where the current glide is, at its speed', () => {
    const current = glideTo(null, -300, 0, 1000, 400);
    const next = glideTo(current, 0, 0, 1200, 100);

    expect(glideAt(next, 1200).position).toBeCloseTo(glideAt(current, 1200).position);
    expect(glideAt(next, 1200).speed).toBeCloseTo(glideAt(current, 1200).speed);
  });

  it('ends sooner when asked to', () => {
    const current = glideTo(null, -300, 0, 1000, 400);

    expect(glideEnd(glideTo(current, 0, 0, 1200, 100))).toBe(1300);
    expect(glideAt(glideTo(current, 0, 0, 1200, 100), 1300)).toEqual({ position: 0, speed: 0 });
  });

  it('never ends later than the current glide', () => {
    const current = glideTo(null, -300, 0, 1000, 400);

    expect(glideEnd(glideTo(current, 0, 0, 1200, 400))).toBe(1400);
  });
});
