import { DIGITS } from '../../pi/digit';
import { SEASONS } from '../seasons';
import { momentAt } from '../../../../testing/sound-moments';
import { DIGIT_PITCHES, ARIA, nameOf, timbreOf } from './aria';
import { Chime } from './sound-model';

describe('Aria', () => {
  const pitchClass = (pitch: number): number => ((pitch % 12) + 12) % 12;
  const note = (chime: Chime): number => chime[0]?.pitch ?? NaN;
  /** The pitch classes of the chord under a note, lowest first, leaving out the low note opening a word. */
  const chordUnder = (chime: Chime): number[] =>
    chime
      .slice(1)
      .slice(-3)
      .map(({ pitch }) => pitchClass(pitch))
      .sort((a, b) => a - b);

  it('plays each digit its own note, wherever it is typed', () => {
    const model = ARIA.create();
    for (const place of [1, 2, 50, 140, 299]) {
      const keys = model.keys(momentAt(place, [], place));
      expect(DIGITS.map((digit) => note(keys[digit]))).toEqual(DIGIT_PITCHES);
    }
  });

  it('plays the same under every key, right digit or not', () => {
    const model = ARIA.create();
    for (let place = 1; place <= 40; place++) {
      const keys = model.keys(momentAt(place, [place - 1], 3));
      const under = new Set(DIGITS.map((digit) => JSON.stringify(keys[digit].slice(1))));
      expect(under.size).toBe(1);
    }
  });

  it('picks the chords from the digits typed before alone, changing every 4 places', () => {
    const model = ARIA.create();
    const chordAfter = (typed: string): number[] =>
      chordUnder(
        model.keys({ ...momentAt(1, [], 3), typed, words: [typed.length], slots: 3 })['0'],
      );

    expect(chordAfter('141')).toEqual(chordAfter(''));
    expect(chordAfter('1415')).not.toEqual(chordAfter('141'));
    const picked = new Set(DIGITS.map((digit) => JSON.stringify(chordAfter(`141${digit}`))));
    expect(picked.size).toBeGreaterThan(1);
    expect(chordAfter('14159')).toEqual(chordAfter('1415'));
  });

  it('plays the chords in a register of its own in each season, the melody the same', () => {
    const model = ARIA.create();
    const moment = momentAt(5, [4], 3);
    const inSeason = SEASONS.map((season) => model.keys({ ...moment, season })['3']);

    expect(new Set(inSeason.map((chime) => note(chime))).size).toBe(1);
    expect(new Set(inSeason.map((chime) => JSON.stringify(chime.slice(2)))).size).toBe(4);
  });

  it("gives each key's note the timbre of its color index, each index its own, the chord under it none", () => {
    const model = ARIA.create();
    const moment = momentAt(1, [], 3);

    expect(model.keys(moment)['2'][0]?.timbre).toBe(timbreOf(moment.colors['2']));
    expect(new Set(Array.from({ length: 10 }, (_, index) => timbreOf(index))).size).toBe(10);
    const under = model.keys(moment)['2'].slice(1);
    expect(under.every(({ timbre }) => timbre === undefined)).toBe(true);
  });

  it('lands a word on a chord holding all of its notes when one does, under the melody', () => {
    const model = ARIA.create();
    const landed = (typed: string, words: number[]): number[] =>
      model.landing(typed, words).map(({ pitch }) => pitchClass(pitch));
    const word = (digits: string): number[] =>
      Array.from(digits, (digit) => pitchClass(DIGIT_PITCHES[Number(digit)] ?? NaN));

    expect(word('141').every((each) => landed('141', [3]).includes(each))).toBe(true);
    expect(word('047').every((each) => landed('047', [3]).includes(each))).toBe(true);
    expect(model.landing('141', [3]).every((each) => each.accompaniment === true)).toBe(true);
  });

  it('tells what a key plays in a line, starting with the digit and its note', () => {
    const model = ARIA.create();

    expect(model.describe(momentAt(5, [4], 3), '9')).toMatch(
      new RegExp(`^9 ${nameOf(DIGIT_PITCHES[9] ?? 0)} `),
    );
  });

  it('plays the same song every time', { tags: ['disabled'] }, () => {
    const a = ARIA.create();
    const b = ARIA.create();
    for (const place of [1, 50, 10, 300]) {
      expect(a.keys(momentAt(place, [], place))).toEqual(b.keys(momentAt(place, [], place)));
    }
  });

  it('names notes with their octave, middle C as C4', () => {
    expect(nameOf(60)).toBe('C4');
    expect(nameOf(70)).toBe('B♭4');
  });
});
