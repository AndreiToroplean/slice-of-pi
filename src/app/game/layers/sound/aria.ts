import { DIGITS, Digit } from '../../pi/digit';
import { PLACES_PER_SEASON } from '../seasons';
import { Chime, Moment, Note, SoundModel, SoundModelKind, SoundNotes } from './sound-model';

/** The major scale, as semitones above its tonic: the chords are built on it. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const;
/** Its pentatonic scale, the notes the keys play: no two a semitone apart, so that no two clash. */
const PENTATONIC = [0, 2, 4, 7, 9] as const;
/** The note the melody starts from, and stays around, as a MIDI note number: the C above middle C. */
const START = 72;
/** Between which pitches the keys stay, from key 0's to key 9's. */
const LOWEST = 55;
const HIGHEST = 93;
/** How many semitones away from the start the note played last has to be for one more key to lead back toward it. */
const PULL = 3;
/** How many places a chord lasts. */
const CHORD_SPAN = 4;
/** Between which pitches the low notes opening the words are, the highest left out. */
const BASS_LOW = 52;
const BASS_HIGH = 64;
/** How many notes of the chord there are under a word's first digit; fewer under the next ones. */
const CHORD_TONES = 3;
/** How loud the melody is, the chord under it, the low note opening each word, and a word's landing chord. */
const MELODY_GAIN = 0.8;
const CHORD_GAIN = 0.6;
const BASS_GAIN = 0.8;
const LANDING_GAIN = 0.45;
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
/** The chords words land on: the open one, a question, and the closed one, its answer. */
const QUESTION = 4;
const ANSWER = 0;

function mod(value: number, by: number): number {
  return ((value % by) + by) % by;
}

/**
 * The key of a place: how many semitones its tonic is above C, from -6 to 5. It moves a fifth up each season, the
 * smoothest change of key, and so goes round all twelve over three years.
 */
export function keyAt(place: number): number {
  const shift = mod(Math.floor(place / PLACES_PER_SEASON) * 7, 12);
  return shift > 5 ? shift - 12 : shift;
}

/** The pitch of a degree of a key's pentatonic scale: degree 0 is its tonic near middle C, 5 the tonic an octave up. */
export function pentatonicPitch(key: number, degree: number): number {
  return (
    60 +
    key +
    12 * Math.floor(degree / PENTATONIC.length) +
    (PENTATONIC[mod(degree, PENTATONIC.length)] ?? 0)
  );
}

/** The pitch of a degree of a key's major scale: degree 0 is its tonic near middle C, 7 the tonic an octave up. */
export function pitchOf(key: number, degree: number): number {
  return (
    60 + key + 12 * Math.floor(degree / MAJOR.length) + (MAJOR[mod(degree, MAJOR.length)] ?? 0)
  );
}

/** The degree of the major scale a pitch is on in a key, if it's on it. */
function majorDegree(key: number, pitch: number): number | undefined {
  const degree = MAJOR.findIndex((semitones) => semitones === mod(pitch - 60 - key, 12));
  return degree < 0 ? undefined : degree;
}

/** The degree of a key's pentatonic scale whose pitch is closest to `pitch`, the lower one if two are. */
function closestPentatonic(key: number, pitch: number): number {
  let degree = Math.floor(((pitch - 60 - key) * PENTATONIC.length) / 12) - 1;
  while (pentatonicPitch(key, degree + 1) <= pitch) {
    degree++;
  }
  return pitch - pentatonicPitch(key, degree) <= pentatonicPitch(key, degree + 1) - pitch
    ? degree
    : degree + 1;
}

/** Whether a pitch is one of the three notes of the chord on the degree `root` of a key. */
function inChord(key: number, root: number, pitch: number): boolean {
  const degree = majorDegree(key, pitch);
  return degree !== undefined && [0, 2, 4].includes(mod(degree - root, MAJOR.length));
}

/** How the keys are laid out at a place, and the chord under them. */
interface Step {
  readonly key: number;
  /** The pitch of the note played before the place: the leading 3's, before the first. */
  readonly played: number;
  /** The key that plays that note again: the keys under it play the notes under it, those over it the notes over it. */
  readonly again: number;
  /** The degree of the pentatonic scale key 0 plays: each key plays one step up from the key before. */
  readonly base: number;
  /** The degree of the major scale the chord's root is on. */
  readonly chord: number;
}

/**
 * The song of π, as typed: how the keys are laid out at each place, worked out in order from the first, from the digits
 * typed before it alone, and kept while they stay the same. The keys play the key's pentatonic scale going up from 0
 * to 9, slid so that a middle key plays the note played last again: a high digit takes the melody up, a low one down,
 * and the higher it has gone, the higher the key playing it again, so that more keys lead back down, and the melody
 * stays around where it started, as melodies do. Once the keys would reach out of range, they move an octave. The chord
 * changes every {@link CHORD_SPAN} places, to one that follows the last naturally and holds the note played last, if
 * one does, the digit typed last picking among them.
 */
class Song {
  private typed = '';
  private readonly steps: Step[] = [];

  /** The step of the place after the digits typed. */
  at(typed: string): Step {
    return this.of(typed, typed.length + 1);
  }

  /** The step of a place, up to the one after the digits typed. */
  of(typed: string, place: number): Step {
    let same = 0;
    while (same < typed.length && same < this.typed.length && typed[same] === this.typed[same]) {
      same++;
    }
    // A place's step depends on the digits typed before it.
    this.steps.length = Math.min(this.steps.length, same + 1);
    this.typed = typed;
    while (this.steps.length <= typed.length) {
      const before = this.steps.at(-1);
      this.steps.push(
        before === undefined
          ? laidOut(keyAt(1), START, 0)
          : next(before, Number(typed[this.steps.length - 1]), this.steps.length + 1),
      );
    }
    const step = this.steps[place - 1];
    if (step === undefined) {
      throw new Error(`No step at place ${String(place)}`);
    }
    return step;
  }
}

/** The step of `place`, after the step before it, where `digit` was typed. */
function next(before: Step, digit: number, place: number): Step {
  const played = pitchAt(before, digit);
  const key = keyAt(place);
  const chord =
    key !== before.key
      ? 0
      : (place - 1) % CHORD_SPAN !== 0
        ? before.chord
        : nextChord(key, before.chord, played, digit);
  return laidOut(key, played, chord);
}

/** The keys laid out around the note played last, as {@link Song} says, moved by octaves if need be to stay in range. */
function laidOut(key: number, played: number, chord: number): Step {
  const again = Math.min(8, Math.max(1, Math.round(4 + (played - START) / PULL)));
  let base = closestPentatonic(key, played) - again;
  while (pentatonicPitch(key, base) < LOWEST) {
    base += PENTATONIC.length;
  }
  while (pentatonicPitch(key, base + 9) > HIGHEST) {
    base -= PENTATONIC.length;
  }
  return { key, played, again, base, chord };
}

/** The chord after `chord`: see {@link Song}. */
function nextChord(key: number, chord: number, played: number, digit: number): number {
  const natural = NEXT[chord] ?? [0];
  const holding = natural.filter((root) => inChord(key, root, played));
  const choices = holding.length > 0 ? holding : natural;
  return choices[digit % choices.length] ?? 0;
}

/** The pitch a digit's key plays at a step. */
function pitchAt(step: Step, digit: number): number {
  return pentatonicPitch(step.key, step.base + digit);
}

/** The pitches of the notes of a chord, each just under `top`. */
function chordUnder(key: number, root: number, top: number): number[] {
  return [0, 2, 4]
    .map((above) => {
      let degree = root + above + 7 * MAJOR.length;
      while (pitchOf(key, degree) >= top) {
        degree -= MAJOR.length;
      }
      return pitchOf(key, degree);
    })
    .sort((a, b) => a - b);
}

/** The pitch of a chord's note closest to `target`, between the low notes' bounds; the lower one if two are. */
function bassNear(key: number, root: number, target: number): number {
  const pitches = [0, 2, 4].flatMap((above) =>
    [-3, -2, -1, 0, 1].map((octave) => pitchOf(key, root + above + octave * MAJOR.length)),
  );
  return pitches
    .filter((pitch) => pitch >= BASS_LOW && pitch < BASS_HIGH)
    .reduce((best, pitch) =>
      Math.abs(pitch - target) < Math.abs(best - target) ||
      (Math.abs(pitch - target) === Math.abs(best - target) && pitch < best)
        ? pitch
        : best,
    );
}

/** The pitch of a chord's root between `low` and `high`, the highest left out, which an octave spans. */
function rootBetween(key: number, root: number, low: number, high: number): number {
  let pitch = pitchOf(key, root);
  while (pitch >= high) {
    pitch -= 12;
  }
  while (pitch < low) {
    pitch += 12;
  }
  return pitch;
}

/** How the chord under a digit is shaped by its place in its word: see {@link Aria}. */
function shapeOf(
  typed: string,
  words: readonly number[],
  slots: number,
): { index: number; size: number; fullness: number; count: number } {
  const index = typed.length - sum(words);
  const size = Math.max(slots, index + 1);
  const fullness = size <= 1 ? 1 : 1 - index / (size - 1);
  return {
    index,
    size,
    fullness,
    count: index === 0 ? CHORD_TONES : Math.round(CHORD_TONES * fullness),
  };
}

/** The names of the notes, by pitch class, from C. */
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const;
/** The chords' numerals, by the degree of their root: upper case for major chords, lower case for minor ones. */
const NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi'] as const;

/** A pitch's name, with its octave, as C4 for middle C. */
export function nameOf(pitch: number): string {
  return `${NAMES[mod(pitch, 12)] ?? ''}${String(Math.floor(pitch / 12) - 1)}`;
}

/** A chord's numeral and name, with its notes, as "vi · A minor (A C E)". */
function chordName(key: number, root: number): string {
  const notes = [0, 2, 4].map((above) => NAMES[mod(pitchOf(key, root + above), 12)] ?? '');
  const minor = NUMERALS[root] === NUMERALS[root]?.toLowerCase();
  return `${NUMERALS[root] ?? ''} · ${notes[0] ?? ''} ${minor ? 'minor' : 'major'} (${notes.join(' ')})`;
}

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Aria, the first sound model. At each place, the keys play the pentatonic scale going up from 0 to 9, like a piano's
 * keys from left to right, slid around the note played last, so that π's digits sound as a melody, high digits taking
 * it up and low ones down, over chords changing every few places, in a key moving a fifth each season (see
 * {@link Song}). It never knows the next digit: the keys are laid out from the digits typed before alone, and the
 * pentatonic scale keeps any of them from clashing.
 *
 * The player's words shape how it's played, never its notes. A word's first digit has the whole chord strummed under
 * it, and a low note; the chord thins out over the word's slots, down to the bare note on the last one, so each word
 * sounds like a phrase, and stretches as slots are added. The low notes opening the words go down a step from one word
 * to the next where the chord lets them, and back up once low. Words land in pairs, like a question and its answer:
 * the first on the open chord (V), the second on the closed one (I).
 */
class Aria implements SoundModel {
  private readonly song = new Song();

  keys({ typed, words, slots }: Moment): Readonly<Record<Digit, Chime>> {
    const step = this.song.at(typed);
    const under = this.texture(typed, words, slots, step);
    return Object.fromEntries(
      DIGITS.map((digit): [Digit, Chime] => [
        digit,
        [{ pitch: pitchAt(step, Number(digit)), gain: MELODY_GAIN }, ...under],
      ]),
    ) as Record<Digit, Chime>;
  }

  describe({ typed, words, slots }: Moment, digit: Digit): SoundNotes {
    const step = this.song.at(typed);
    const change = Number(digit) - step.again;
    const move =
      change === 0
        ? `the last note again, as key ${String(step.again)} does here`
        : `${plural(Math.abs(change), 'step')} ${change > 0 ? 'up' : 'down'} from the last note, which key ${String(step.again)} plays again`;
    const { index, size, count } = shapeOf(typed, words, slots);
    const under =
      index === 0
        ? `whole chord, strummed, low ${nameOf(this.bass(typed, words))}`
        : count === 0
          ? 'the note alone'
          : plural(count, 'chord note');
    const lands = words.length % 2 === 0 ? QUESTION : ANSWER;
    return {
      pi: [
        { label: 'Note', value: nameOf(pitchAt(step, Number(digit))) },
        { label: 'Melody', value: move },
        { label: 'Chord', value: chordName(step.key, step.chord) },
        { label: 'Key', value: `${NAMES[mod(step.key, 12)] ?? ''} major` },
      ],
      word: [
        { label: 'Digit', value: `${String(index + 1)} of ${String(size)}` },
        { label: 'Under it', value: under },
        {
          label: 'Lands on',
          value: `${chordName(step.key, lands)}, ${lands === QUESTION ? 'open, a question' : 'closed, an answer'}`,
        },
      ],
    };
  }

  landing(words: readonly number[]): Chime {
    const key = keyAt(Math.max(1, sum(words)));
    const root = words.length % 2 === 1 ? QUESTION : ANSWER;
    const base =
      root + MAJOR.length * Math.round((rootBetween(key, root, 58, 70) - pitchOf(key, root)) / 12);
    return [
      { pitch: rootBetween(key, root, BASS_LOW, BASS_HIGH), gain: BASS_GAIN },
      ...[0, 2, 4, 7].map((above) => ({ pitch: pitchOf(key, base + above), gain: LANDING_GAIN })),
    ].map((note, i) => ({ ...note, accompaniment: true as const, delay: i * ROLL }));
  }

  /**
   * What sounds under the note of a place, the same whatever key is touched: the chord, strummed up from the low note
   * on a word's first digit, then thinning out over the word.
   */
  private texture(typed: string, words: readonly number[], slots: number, step: Step): Note[] {
    const { index, fullness, count } = shapeOf(typed, words, slots);
    const top = step.played;
    const strum = index === 0 ? STRUM : 0;
    const chord: Note[] = chordUnder(step.key, step.chord, top)
      .slice(CHORD_TONES - count)
      .map((pitch, i) => ({
        pitch,
        gain: CHORD_GAIN * (0.4 + 0.6 * fullness),
        accompaniment: true,
        delay: (i + 1) * strum,
      }));
    return index === 0
      ? [{ pitch: this.bass(typed, words), gain: BASS_GAIN, accompaniment: true }, ...chord]
      : chord;
  }

  /** The low note opening the word after `words`: see {@link Aria}. */
  private bass(typed: string, words: readonly number[]): number {
    let start = 0;
    let bass: number | undefined;
    for (const size of [...words, 0]) {
      const step = this.song.of(typed, start + 1);
      const target =
        bass === undefined ? BASS_HIGH - 5 : bass - 2 < BASS_LOW ? bass + 10 : bass - 2;
      bass = bassNear(step.key, step.chord, target);
      start += size;
    }
    return bass ?? BASS_LOW;
  }
}

export const ARIA: SoundModelKind = {
  id: 'aria',
  label: 'Aria',
  description:
    'The keys play a pentatonic scale slid around the note played last, so that π sounds as a melody, high digits taking it up and low ones down, over chords changing every few places; the words phrase it.',
  create: () => new Aria(),
};
