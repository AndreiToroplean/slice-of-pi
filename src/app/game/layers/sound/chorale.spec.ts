import { DIGITS } from '../../pi/digit';
import { PI_DECIMALS } from '../../pi/pi-decimals';
import { momentAt } from '../../../../testing/sound-moments';
import { nameOf } from './aria';
import {
  CHORALE,
  CHORALE_PITCHES,
  echoOf,
  harmonize,
  harmonizeAll,
  Harmony,
  Meter,
  metersOf,
  parallel,
} from './chorale';

describe('Chorale', () => {
  const pitchClass = (pitch: number): number => ((pitch % 12) + 12) % 12;
  /** Words of sizes a player might type them in, 2000 places' worth. */
  const words = Array.from({ length: 500 }, (_, i) => [5, 3, 4, 6, 2, 7, 4][i % 7] ?? 4);
  const song = harmonizeAll(PI_DECIMALS.slice(0, 2000), words);
  const meters = metersOf(2000, words, 0);
  const question = (slot: number, size: number): Meter => ({ slot, size, answer: false });
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

  it('harmonizes each place from the digits and words up to it alone', () => {
    expect(harmonizeAll('14159265', [3, 5]).slice(0, 5)).toEqual(harmonizeAll('14159', [3, 5]));
    const model = CHORALE.create();
    for (const [typed, done, slots] of [
      ['14159265', [3, 5], 4],
      ['1415', [3], 5],
      ['1415', [3], 3],
      ['1426', [4], 2],
      ['14159', [2, 3], 3],
    ] as const) {
      const moment = { ...momentAt(1, [], 5), typed, words: done, slots };
      expect(model.keys(moment)).toEqual(CHORALE.create().keys(moment));
    }
  });

  it('takes its bars from the words, the slots setting the size of the one being typed', () => {
    const answer = (slot: number, size: number): Meter => ({ slot, size, answer: true });
    expect(metersOf(4, [2], 3)).toEqual([
      question(0, 2),
      question(1, 2),
      answer(0, 3),
      answer(1, 3),
    ]);
    expect(metersOf(6, [2], 3).slice(2)).toEqual([0, 1, 2, 3].map((slot) => answer(slot, 4)));
    const moment = { ...momentAt(1, [], 5), typed: '1415926' };
    const model = CHORALE.create();
    expect(model.keys({ ...moment, words: [3, 4], slots: 5 })).not.toEqual(
      model.keys({ ...moment, words: [4, 3], slots: 5 }),
    );
  });

  it('strikes the chord on the first digit of each word, whatever key is typed', () => {
    const model = CHORALE.create();
    for (const [typed, done] of [
      ['141', [3]],
      ['14159', [2, 3]],
      ['1415926', [3, 4]],
    ] as const) {
      const keys = model.keys({ ...momentAt(1, [], 5), typed, words: done, slots: 4 });
      expect(DIGITS.every((digit) => keys[digit].length === 4)).toBe(true);
    }
  });

  it('puts each note on a chord holding it, or passing over it by a step on a weak beat', () => {
    song.forEach((harmony, index) => {
      const before = song[index - 1];
      const passes =
        before !== undefined &&
        meters[index]?.slot !== undefined &&
        meters[index].slot % 2 === 1 &&
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

  it('ends each answer on C whenever its last note lets it, each question on G most of the time it can', () => {
    let questions = 0;
    let onG = 0;
    meters.forEach((meter, index) => {
      const harmony = song[index];
      if (harmony === undefined || meter.slot !== meter.size - 1) {
        return;
      }
      if (meter.answer && holds({ ...harmony, chord: 'I' }, harmony.melody)) {
        expect(harmony.chord).toBe('I');
      }
      if (!meter.answer && holds({ ...harmony, chord: 'V' }, harmony.melody)) {
        questions++;
        onG += harmony.chord === 'V' || harmony.chord === 'V7' ? 1 : 0;
      }
    });
    expect(onG / questions).toBeGreaterThan(0.75);
  });

  it('keeps the chord over a weak beat when the note fits it, its voices ringing', () => {
    const first = harmonize(0, question(0, 5), undefined);
    const second = harmonize(4, question(1, 5), first);

    expect(first.chord).toBe('I');
    expect(second).toEqual({ ...first, held: 2, melody: CHORALE_PITCHES[4], struck: false });
    expect(CHORALE.create().keys({ ...momentAt(1, [], 5), typed: '0' })['4']).toHaveLength(1);
  });

  it('strikes the voices under the melody where they change, as its accompaniment', () => {
    const keys = CHORALE.create().keys(momentAt(1, [], 5));
    const under = keys['1'].slice(1);

    expect(under.map(({ pitch }) => pitch)).toEqual(harmonize(1, question(0, 5), undefined).voices);
    expect(under.every(({ accompaniment }) => accompaniment)).toBe(true);
  });

  it('echoes a word as it lands: its last chord climbing to its last note an octave up', () => {
    const model = CHORALE.create();
    const question = model.landing('14159', [5]);
    const last = harmonizeAll('14159', [5]).at(-1);

    expect(question.map(({ pitch }) => pitch)).toEqual(last && echoOf(last, false));
    expect(question.at(-1)?.pitch).toBe((last?.melody ?? 0) + 12);
    expect(question.every((note) => last !== undefined && holds(last, note.pitch))).toBe(true);
    expect(question.every(({ accompaniment }) => accompaniment)).toBe(true);
  });

  it('echoes a question in 2 notes, an answer in 3 over its root, low', () => {
    const model = CHORALE.create();
    const answer = model.landing('14159265', [5, 3]);
    const last = harmonizeAll('14159265', [5, 3]).at(-1);

    expect(model.landing('14159', [5])).toHaveLength(2);
    expect(answer).toHaveLength(4);
    expect(pitchClass(answer[0]?.pitch ?? NaN)).toBe(tones[last?.chord ?? '']?.[0]);
    expect(answer[0]?.pitch).toBeLessThan(last?.voices[1] ?? 0);
  });

  it("leans a word's first chord towards one holding the note the last word's echo ends on", () => {
    const opening = (typed: string, done: number[]) => harmonizeAll(typed, done).at(-1)?.chord;
    // After a word ending on C, its echo ends on C: under the next D, Dm7 holds it, where Dm doesn't.
    expect(opening('0001', [3, 1])).toBe('ii7');
  });

  it('tells what a key plays in a line, starting with the digit, its note and its chord', () => {
    expect(CHORALE.create().describe({ ...momentAt(1, [], 5), typed: '' }, '0')).toMatch(
      new RegExp(`^0 ${nameOf(CHORALE_PITCHES[0] ?? 0)} on C \\(I\\) `),
    );
  });
});
