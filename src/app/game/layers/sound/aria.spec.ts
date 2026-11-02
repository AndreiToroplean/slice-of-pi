import { DIGITS, Digit } from '../../pi/digit';
import { PI_DECIMALS } from '../../pi/pi-decimals';
import { PLACES_PER_SEASON } from '../seasons';
import { ARIA, keyAt, pitchOf } from './aria';
import { Chime } from './sound-model';

describe('Aria', () => {
  const PLACES = 300;
  const right = (place: number): Digit => PI_DECIMALS.charAt(place - 1) as Digit;
  /** The pitch class of a pitch, from 0 (C) to 11 (B). */
  const pitchClass = (pitch: number): number => ((pitch % 12) + 12) % 12;
  /** What each key plays at a place, a word starting there. */
  const keysAt = (place: number, slots = 5): Readonly<Record<Digit, Chime>> =>
    ARIA.create().keys({ place, words: place > 1 ? [place - 1] : [], slots });
  const melody = (chime: Chime | undefined): number => chime?.[0]?.pitch ?? NaN;

  it('plays the scale going up from key 0 to key 9, at every place', () => {
    const model = ARIA.create();
    for (let place = 1; place <= PLACES; place++) {
      const keys = model.keys({ place, words: [], slots: place });
      const pitches = DIGITS.map((digit) => melody(keys[digit]));
      const steps = pitches.slice(1).map((pitch, i) => pitch - (pitches[i] ?? 0));
      expect(steps.every((step) => step === 1 || step === 2)).toBe(true);
    }
  });

  it('slides the scale from place to place, so that the keys play other notes', () => {
    const zeros = new Set(Array.from({ length: 20 }, (_, i) => melody(keysAt(i + 1)['0'])));

    expect(zeros.size).toBeGreaterThan(2);
  });

  it("plays the right digit on a note of the chord under it, in the season's key", () => {
    for (let place = 1; place <= PLACES; place++) {
      const keys = keysAt(place);
      const chime = keys[right(place)];
      const note = melody(chime);
      const chord = chime.slice(2).map(({ pitch }) => pitchClass(pitch));
      expect(chord).toContain(pitchClass(note));
      const scale = [0, 1, 2, 3, 4, 5, 6].map((degree) =>
        pitchClass(pitchOf(keyAt(place), degree)),
      );
      expect(scale).toContain(pitchClass(note));
    }
  });

  it("moves the melody with π's digits: up, down, or staying, by a few steps of the scale", () => {
    for (let place = 2; place <= PLACES; place++) {
      if (keyAt(place) !== keyAt(place - 1)) {
        continue;
      }
      const before = melody(keysAt(place - 1)[right(place - 1)]);
      const now = melody(keysAt(place)[right(place)]);
      const change = Number(right(place)) - Number(right(place - 1));
      expect(Math.abs(now - before)).toBeLessThanOrEqual(6);
      if (change === 0) {
        expect(now).toBe(before);
      } else {
        expect(now).not.toBe(before);
      }
    }
  });

  it('keeps the melody within its range', () => {
    for (let place = 1; place <= PLACES; place++) {
      const note = melody(keysAt(place)[right(place)]);
      expect(note).toBeGreaterThanOrEqual(64);
      expect(note).toBeLessThanOrEqual(86);
    }
  });

  it('moves the key a fifth up each season', () => {
    expect(keyAt(1)).toBe(0);
    expect(keyAt(PLACES_PER_SEASON)).toBe(-5);
    expect(keyAt(2 * PLACES_PER_SEASON)).toBe(2);
    expect(pitchClass(pitchOf(keyAt(PLACES_PER_SEASON), 0))).toBe(7);
  });

  it('plays the same song every time', () => {
    const a = ARIA.create();
    const b = ARIA.create();
    for (const place of [1, 50, 10, 120]) {
      expect(a.keys({ place, words: [], slots: place })).toEqual(
        b.keys({ place, words: [], slots: place }),
      );
    }
  });

  it("thins the chord out over the word's slots, and stretches it as slots are added", () => {
    const model = ARIA.create();
    const under = (place: number, slots: number): number =>
      model.keys({ place, words: [3], slots })['0'].length - 1;

    expect([4, 5, 6, 7, 8].map((place) => under(place, 5))).toEqual([4, 2, 2, 1, 0]);
    expect(under(7, 9)).toBe(2);
  });

  it('opens each word with a low note a step below the last, back up once low', () => {
    const model = ARIA.create();
    const words: number[] = [];
    let previous: number | undefined;
    for (let word = 0; word < 40; word++) {
      const place = words.reduce((total, size) => total + size, 0) + 1;
      const bass = model.keys({ place, words, slots: 3 })['0'][1]?.pitch ?? NaN;
      expect(bass).toBeGreaterThanOrEqual(48);
      expect(bass).toBeLessThan(60);
      if (previous !== undefined && bass > previous) {
        expect(previous - 2).toBeLessThan(50);
      }
      previous = bass;
      words.push(3);
    }
  });

  it('lands words in pairs, the first on the open chord, the second on the closed one', () => {
    const model = ARIA.create();
    const root = (words: number[]): number => pitchClass(model.landing(words)[0]?.pitch ?? NaN);

    expect(root([3])).toBe(7);
    expect(root([3, 4])).toBe(0);
    expect(root([3, 4, 2])).toBe(7);
    expect(model.landing([3]).every((note) => note.accompaniment === true)).toBe(true);
  });
});
