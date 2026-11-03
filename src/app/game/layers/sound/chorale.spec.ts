import { DIGITS } from '../../pi/digit';
import { PI_DECIMALS } from '../../pi/pi-decimals';
import { momentAt } from '../../../../testing/sound-moments';
import { nameOf } from './aria';
import { CHORALE, CHORALE_PITCHES, harmonize, harmonizeAll, Harmony, parallel } from './chorale';

describe('Chorale', () => {
  const pitchClass = (pitch: number): number => ((pitch % 12) + 12) % 12;
  const song = harmonizeAll(PI_DECIMALS.slice(0, 2000));
  /** The pitch classes of a chord, by its name. */
  const tones: Record<string, number[]> = {
    I: [0, 4, 7],
    ii: [2, 5, 9],
    ii7: [2, 5, 9, 0],
    iii: [4, 7, 11],
    IV: [5, 9, 0],
    V: [7, 11, 2],
    V7: [7, 11, 2, 5],
    vi: [9, 0, 4],
    'V/V': [2, 6, 9],
    'V/vi': [4, 8, 11],
  };
  const holds = (harmony: Harmony, pitch: number): boolean =>
    tones[harmony.chord]?.includes(pitchClass(pitch)) ?? false;

  it('plays each digit its own note on top, wherever it is typed', () => {
    const model = CHORALE.create();
    for (const place of [1, 2, 50, 140, 299]) {
      const keys = model.keys(momentAt(place, [], place));
      expect(DIGITS.map((digit) => keys[digit][0]?.pitch)).toEqual(CHORALE_PITCHES);
    }
  });

  it('harmonizes each place from the digits up to it alone', () => {
    expect(harmonizeAll('14159265').slice(0, 5)).toEqual(harmonizeAll('14159'));
    const model = CHORALE.create();
    for (const typed of ['14159265', '1415', '1426', '14159']) {
      const moment = { ...momentAt(1, [], 5), typed };
      expect(model.keys(moment)).toEqual(CHORALE.create().keys(moment));
    }
  });

  it('puts each note on a chord holding it, or passing over it by a step on a weak beat', () => {
    song.forEach((harmony, index) => {
      const before = song[index - 1];
      const passes =
        before !== undefined &&
        index % 2 === 1 &&
        harmony.chord === before.chord &&
        Math.abs(harmony.melody - before.melody) <= 2;
      expect(holds(harmony, harmony.melody) || passes).toBe(true);
    });
  });

  it('sings each chord in four voices in order, with its root and third', () => {
    for (const harmony of song) {
      const [bass, tenor, alto] = harmony.voices;
      expect(bass < tenor && tenor < alto && alto < harmony.melody).toBe(true);
      if (harmony.struck) {
        const sung = [...harmony.voices, harmony.melody].map(pitchClass);
        const [root, third] = tones[harmony.chord] ?? [];
        expect(sung).toContain(root);
        expect(sung).toContain(third);
        expect(harmony.voices.every((pitch) => holds(harmony, pitch))).toBe(true);
      }
    }
  });

  it('moves voices in parallel fifths or octaves only where the melody leaves no other way, rarely', () => {
    const voices = (harmony: Harmony): number[] => [...harmony.voices, harmony.melody];
    const parallels = song.filter((harmony, index) => {
      const before = song[index - 1];
      if (before === undefined || !harmony.struck) {
        return false;
      }
      const [now, then] = [voices(harmony), voices(before)];
      const pair = (pitches: number[], low: number, high: number) =>
        [pitches[low] ?? 0, pitches[high] ?? 0] as const;
      return [0, 1, 2, 3].some((low) =>
        [0, 1, 2, 3].some(
          (high) => low < high && parallel(pair(then, low, high), pair(now, low, high)),
        ),
      );
    });
    expect(parallels.length).toBeLessThan(song.length / 100);
  });

  it('tells parallel fifths and octaves from those reached by contrary motion', () => {
    expect(parallel([48, 55], [50, 57])).toBe(true);
    expect(parallel([48, 60], [47, 59])).toBe(true);
    expect(parallel([53, 65], [48, 72])).toBe(false);
    expect(parallel([48, 55], [48, 55])).toBe(false);
    expect(parallel([48, 55], [50, 59])).toBe(false);
  });

  it('ends each period on C whenever its last note lets it', () => {
    song.forEach((harmony, index) => {
      if (index % 16 === 15 && holds({ ...harmony, chord: 'I' }, harmony.melody)) {
        expect(harmony.chord).toBe('I');
      }
    });
  });

  it('keeps the chord over a weak beat when the note fits it, its voices ringing', () => {
    const first = harmonize(0, 0, undefined);
    const second = harmonize(4, 1, first);

    expect(first.chord).toBe('I');
    expect(second).toEqual({ ...first, held: 2, melody: CHORALE_PITCHES[4], struck: false });
    expect(CHORALE.create().keys({ ...momentAt(1, [], 5), typed: '0' })['4']).toHaveLength(1);
  });

  it('strikes the voices under the melody where they change, as its accompaniment', () => {
    const keys = CHORALE.create().keys(momentAt(1, [], 5));
    const under = keys['1'].slice(1);

    expect(under.map(({ pitch }) => pitch)).toEqual(harmonize(1, 0, undefined).voices);
    expect(under.every(({ accompaniment }) => accompaniment)).toBe(true);
  });

  it('plays nothing as words land', () => {
    expect(CHORALE.create().landing('14159', [5])).toEqual([]);
  });

  it('tells what a key plays in a line, starting with the digit, its note and its chord', () => {
    expect(CHORALE.create().describe({ ...momentAt(1, [], 5), typed: '' }, '0')).toMatch(
      new RegExp(`^0 ${nameOf(CHORALE_PITCHES[0] ?? 0)} on C \\(I\\) `),
    );
  });
});
