import { atTempo, Chime } from './sound-model';

describe('atTempo', () => {
  const chime: Chime = [
    { pitch: 72, gain: 1, length: 0.8 },
    { pitch: 48, gain: 0.5, length: 1.2, accompaniment: true, delay: 0.04 },
  ];

  it('rings and rolls the notes for less time played faster, more played slower, at their own pitch', () => {
    expect(atTempo(chime, 2)).toEqual([
      { pitch: 72, gain: 1, length: 0.4 },
      { pitch: 48, gain: 0.5, length: 0.6, accompaniment: true, delay: 0.02 },
    ]);
    expect(atTempo(chime, 1 / 4)).toEqual([
      { pitch: 72, gain: 1, length: 3.2 },
      { pitch: 48, gain: 0.5, length: 4.8, accompaniment: true, delay: 0.16 },
    ]);
  });

  it('leaves the chime as it is at its own tempo', () => {
    expect(atTempo(chime, 1)).toBe(chime);
  });
});
