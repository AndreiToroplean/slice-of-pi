import { DIGITS, Digit } from '../../pi/digit';
import { Season } from '../seasons';
import { Chime, Moment, Note, SoundModel, SoundModelKind } from './sound-model';

/** The major scale, as semitones above its tonic: the chords are built on it. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const;
/**
 * The note of each digit, as a MIDI note number (60 is middle C): C major's pentatonic scale going up, from C for 0 to
 * A for 9, two octaves on. No two are a semitone apart, so that none clashes with another, nor with the chords.
 */
export const DIGIT_PITCHES: readonly number[] = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
/** How many places a chord lasts. */
const CHORD_SPAN = 4;
/**
 * Where the octave of the chords under the notes starts, in each season: high and light in spring, warm in summer,
 * lower in autumn, and lowest, darkest, in winter.
 */
const CHORD_LOWS: Readonly<Record<Season, number>> = {
  spring: 60,
  summer: 55,
  autumn: 52,
  winter: 48,
};
/** Where the octave of the low notes opening the words starts. */
const BASS_LOW = 48;
const BASS_HIGH = BASS_LOW + 12;
/** How many notes of the chord there are under a word's first digit; fewer under the next ones. */
const CHORD_TONES = 3;
/** How loud the digit's note is, the chord under it, the low note opening each word, and a word's landing chord. */
const NOTE_GAIN = 0.8;
const CHORD_GAIN = 0.6;
const BASS_GAIN = 0.8;
const LANDING_GAIN = 0.45;
/**
 * How long a note rings, in seconds: on a word's first digit, as it opens; on those inside it, shorter, so that they
 * move on; on its last slot, longer, as phrases end; and as it lands.
 */
const OPENING_LENGTH = 1.2;
const INNER_LENGTH = 0.7;
const CLOSING_LENGTH = 1.8;
const LANDING_LENGTH = 2.2;
/** How long after each other the notes of a chord start, in seconds, strummed upward rather than struck. */
const STRUM = 0.035;
const ROLL = 0.06;

/** The chords, by the degree of their root (I, ii, iii, IV, V and vi), and those each leads to most naturally, first. */
const NEXT: Readonly<Record<number, readonly number[]>> = {
  0: [3, 4, 5, 1, 2],
  1: [4, 5, 0],
  2: [5, 3],
  3: [4, 0, 1],
  4: [0, 5, 3],
  5: [1, 3, 4, 2],
};
/**
 * The chords words land on, by how well they end: the open ones first for a question, the first word of a pair, and
 * the closed ones first for its answer.
 */
const QUESTIONS = [4, 3, 1, 2, 5, 0] as const;
const ANSWERS = [0, 5, 3, 4, 1, 2] as const;

function mod(value: number, by: number): number {
  return ((value % by) + by) % by;
}

/** The pitch of a degree of C major: degree 0 is middle C, 7 the C an octave up. */
export function pitchOf(degree: number): number {
  return 60 + 12 * Math.floor(degree / MAJOR.length) + (MAJOR[mod(degree, MAJOR.length)] ?? 0);
}

/** Whether a pitch is one of the three notes of the chord on the degree `root`. */
function inChord(root: number, pitch: number): boolean {
  const degree = MAJOR.findIndex((semitones) => semitones === mod(pitch - 60, 12));
  return degree >= 0 && [0, 2, 4].includes(mod(degree - root, MAJOR.length));
}

/**
 * The chord under each place, worked out in order from the first, from the digits typed before it alone, and kept
 * while they stay the same. It starts on C major (I) and changes every {@link CHORD_SPAN} places, to one that follows
 * the last naturally: of those that hold the note played last, if any, the digit typed last picking among them.
 */
class Chords {
  private typed = '';
  private readonly roots: number[] = [];

  /** The root of the chord of a place, up to the one after the digits typed. */
  of(typed: string, place: number): number {
    let same = 0;
    while (same < typed.length && same < this.typed.length && typed[same] === this.typed[same]) {
      same++;
    }
    // A place's chord depends on the digits typed before it.
    this.roots.length = Math.min(this.roots.length, same + 1);
    this.typed = typed;
    while (this.roots.length < place) {
      const next = this.roots.length + 1;
      const before = this.roots.at(-1);
      this.roots.push(
        before === undefined
          ? 0
          : (next - 1) % CHORD_SPAN !== 0
            ? before
            : nextChord(before, Number(typed[next - 2])),
      );
    }
    return this.roots[place - 1] ?? 0;
  }
}

/** The chord after `chord`, the place before having played `digit`: see {@link Chords}. */
function nextChord(chord: number, digit: number): number {
  const natural = NEXT[chord] ?? [0];
  const played = DIGIT_PITCHES[digit] ?? 60;
  const holding = natural.filter((root) => inChord(root, played));
  const choices = holding.length > 0 ? holding : natural;
  return choices[digit % choices.length] ?? 0;
}

/**
 * The chord a word lands on: the one holding the most of its notes, the more open one as the first word of a pair, a
 * question, and the more closed one as the second, its answer.
 */
function landingChord(digits: string, question: boolean): number {
  const order = question ? QUESTIONS : ANSWERS;
  const held = (root: number): number =>
    Array.from(digits).filter((digit) => inChord(root, DIGIT_PITCHES[Number(digit)] ?? 60)).length;
  return order.reduce((best, root) => (held(root) > held(best) ? root : best), order[0]);
}

/** The pitches of a chord's notes in the octave from `low`, lowest first. */
function chordFrom(root: number, low: number): number[] {
  return [0, 2, 4].map((above) => from(pitchOf(root + above), low)).sort((a, b) => a - b);
}

/** A pitch moved by octaves into the octave from `low`. */
function from(pitch: number, low: number): number {
  return low + mod(pitch - low, 12);
}

/** The pitch of a chord's note closest to `target`, between the low notes' bounds; the lower one if two are. */
function bassNear(root: number, target: number): number {
  return chordFrom(root, BASS_LOW).reduce((best, pitch) =>
    Math.abs(pitch - target) < Math.abs(best - target) ? pitch : best,
  );
}

/**
 * A key's note's timbre, by its color index: a tenth of the way round the wheel of timbres for each step, so that the
 * ten colors sound ten ways, each a little on from the last, 9 leading back to 0 as any color to the next.
 */
export function timbreOf(colorIndex: number): number {
  return colorIndex / 10;
}

/** How the chord under a digit is shaped by its place in its word: see {@link Aria}. */
function shapeOf(
  typed: string,
  words: readonly number[],
  slots: number,
): { index: number; size: number; fullness: number; count: number; length: number } {
  const index = typed.length - sum(words);
  const size = Math.max(slots, index + 1);
  const fullness = size <= 1 ? 1 : 1 - index / (size - 1);
  return {
    index,
    size,
    fullness,
    count: index === 0 ? CHORD_TONES : Math.round(CHORD_TONES * fullness),
    length: index === size - 1 ? CLOSING_LENGTH : index === 0 ? OPENING_LENGTH : INNER_LENGTH,
  };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Aria, a sound model as plain as a song for a single voice. See {@link ARIA}'s `about` for how it plays, which
 * developer mode shows.
 */
class Aria implements SoundModel {
  private readonly chords = new Chords();

  keys({ typed, words, slots, colors, season }: Moment): Readonly<Record<Digit, Chime>> {
    const { length } = shapeOf(typed, words, slots);
    const under = this.texture(typed, words, slots, season);
    return Object.fromEntries(
      DIGITS.map((digit): [Digit, Chime] => [
        digit,
        [
          {
            pitch: DIGIT_PITCHES[Number(digit)] ?? 60,
            gain: NOTE_GAIN,
            timbre: timbreOf(colors[digit]),
            length,
          },
          ...under,
        ],
      ]),
    ) as Record<Digit, Chime>;
  }

  landing(typed: string, words: readonly number[]): Chime {
    const root = this.landed(typed, words);
    const [first, second, third] = chordFrom(root, 60);
    return [
      { pitch: from(pitchOf(root), BASS_LOW), gain: BASS_GAIN },
      ...[first, second, third, (first ?? 60) + 12].map((pitch) => ({
        pitch: pitch ?? 60,
        gain: LANDING_GAIN,
      })),
    ].map((note, i) => ({
      ...note,
      length: LANDING_LENGTH,
      accompaniment: true as const,
      delay: i * ROLL,
    }));
  }

  /** The chord a word lands on: see {@link landingChord}. */
  private landed(typed: string, words: readonly number[]): number {
    const end = sum(words);
    return landingChord(typed.slice(end - (words.at(-1) ?? 0), end), words.length % 2 === 1);
  }

  /**
   * What sounds under the digit's note, the same whatever digit is typed: the place's chord, strummed up from the low
   * note on a word's first digit, then thinning out over the word, in the season's register.
   */
  private texture(typed: string, words: readonly number[], slots: number, season: Season): Note[] {
    const { index, fullness, count, length } = shapeOf(typed, words, slots);
    const root = this.chords.of(typed, typed.length + 1);
    const strum = index === 0 ? STRUM : 0;
    const chord: Note[] = chordFrom(root, CHORD_LOWS[season])
      .slice(CHORD_TONES - count)
      .map((pitch, i) => ({
        pitch,
        gain: CHORD_GAIN * (0.4 + 0.6 * fullness),
        length,
        accompaniment: true,
        delay: (i + 1) * strum,
      }));
    return index === 0
      ? [{ pitch: this.bass(typed, words), gain: BASS_GAIN, length, accompaniment: true }, ...chord]
      : chord;
  }

  /**
   * The low note opening the word after `words`: a note of its chord a step below the last word's, where the chord
   * lets it, and back up once low.
   */
  private bass(typed: string, words: readonly number[]): number {
    let start = 0;
    let bass: number | undefined;
    for (const size of [...words, 0]) {
      const root = this.chords.of(typed, start + 1);
      const target =
        bass === undefined ? BASS_HIGH - 5 : bass - 2 < BASS_LOW ? bass + 10 : bass - 2;
      bass = bassNear(root, target);
      start += size;
    }
    return bass ?? BASS_LOW;
  }
}

export const ARIA: SoundModelKind = {
  id: 'aria',
  label: 'Aria',
  about: [
    'Each digit always plays its own note: C major’s pentatonic scale going up, from C4 for 0 to A5 for 9. No two notes are a semitone apart, so none clashes with another.',
    'The key’s color index sets the note’s tone color, its timbre: tones 0 to 9 go round a wheel, each lifting other harmonics of the note, as a voice’s vowels do, and tone 9 leads back to 0 as any tone to the next. A digit typed again and again changes its tone a step at a time, never jumping.',
    'A chord sounds under each note. It changes every 4 places, to one that follows the last naturally and holds the note played last, the digit typed last picking among them.',
    'Each season plays the chords in its own register: high and light in spring, warm in summer, lower in autumn, lowest in winter.',
    'Your words phrase it. A word’s first digit strums the whole chord, with a low note; the chord thins out over the word’s slots, down to the note alone on the last. The low notes opening the words go down a step from word to word.',
    'Notes ring longer at both ends of a word: 1.2 s on its first digit, 0.7 s inside it, 1.8 s on its last slot.',
    'As a word lands on the tape, it plays the chord holding the most of its notes: words come in pairs, like a question and its answer, the first leaning on open chords (G, F), the second on closed ones (C, Am).',
    'It never knows π: only the digits typed before, so a key sounds the same, right or wrong.',
  ],
  create: () => new Aria(),
};
