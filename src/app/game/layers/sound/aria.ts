import { DIGITS, Digit } from '../../pi/digit';
import { PI_DECIMALS } from '../../pi/pi-decimals';
import { PLACES_PER_SEASON } from '../seasons';
import { Chime, Moment, Note, SoundModel, SoundModelKind } from './sound-model';

/** The major scale, as semitones above its tonic. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const;
const DEGREES = MAJOR.length;
/** The most steps of the scale the melody moves by from one place to the next. */
const LONGEST_MOVE = 3;
/** Where the melody starts, and stays between, as MIDI note numbers. */
const MELODY_CENTER = 74;
const MELODY_LOW = 64;
const MELODY_HIGH = 86;
/** Between which pitches the low notes opening the words are, the highest left out. */
const BASS_LOW = 48;
const BASS_HIGH = 60;
/** How many places ahead a chord is picked to fit, besides its own. */
const LOOKAHEAD = 4;
/** How many notes of the chord there are under a word's first digit; fewer under the next ones. */
const CHORD_TONES = 3;
/** How loud the melody is, the chord under it, the low note opening each word, and a word's landing chord. */
const MELODY_GAIN = 0.8;
const CHORD_GAIN = 0.45;
const BASS_GAIN = 0.7;
const LANDING_GAIN = 0.4;
/** How long after each other the notes of a landing chord start, in seconds. */
const ROLL = 0.05;

/** The chords, by the degree of their root (I, ii, iii, IV, V and vi), and those each leads to most naturally, first. */
const NEXT: Readonly<Record<number, readonly number[]>> = {
  0: [3, 4, 5, 1, 2],
  1: [4, 5, 0],
  2: [5, 3],
  3: [4, 0, 1],
  4: [0, 5, 3],
  5: [1, 3, 4, 2],
};
const CHORDS = [0, 1, 2, 3, 4, 5] as const;
/** The chords words land on: the open one, a question, and the closed one, its answer. */
const QUESTION = 4;
const ANSWER = 0;

/** The right digit at a place, as a number; 0 past the decimals the game knows. */
function digitAt(place: number): number {
  return Number(PI_DECIMALS.charAt(place - 1) || '0');
}

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

/** The pitch of a degree of a key's major scale: degree 0 is its tonic near middle C, 7 the tonic an octave up. */
export function pitchOf(key: number, degree: number): number {
  return 60 + key + 12 * Math.floor(degree / DEGREES) + (MAJOR[mod(degree, DEGREES)] ?? 0);
}

/** Whether a degree is one of the three notes of the chord on `root`. */
function inChord(root: number, degree: number): boolean {
  return mod(degree - root, DEGREES) % 2 === 0 && mod(degree - root, DEGREES) <= 4;
}

/** The right note of a place, and what sounds around it. */
interface Step {
  readonly key: number;
  /** The degree of the right note, counted from the key's tonic near middle C: its octave too. */
  readonly degree: number;
  /** The degree of the root of the chord under it. */
  readonly chord: number;
}

/**
 * The song of π: each place's right note and chord, worked out in order from the first, and kept. The melody follows
 * π's ups and downs, by steps of the scale: up when the digit is higher than the one before, down when it's lower, and
 * staying when it's the same, by a step for a small change and up to {@link LONGEST_MOVE} for a large one, so that it
 * moves smoothly, yet as unpredictably as π; it turns back rather than leave its range. The chord holds while the right
 * notes are in it; when one isn't, the next is the chord that fits the most notes coming, among those with it, then
 * the one that follows the last most naturally, π's digit picking among any still level.
 */
class Song {
  /** The degree of each place's right note, in its key, from place 1. */
  private readonly melody: number[] = [];
  private readonly steps: Step[] = [];

  at(place: number): Step {
    while (this.steps.length < place) {
      this.steps.push(this.next(this.steps.length + 1));
    }
    const step = this.steps[place - 1];
    if (step === undefined) {
      throw new Error(`Not a place: ${String(place)}`);
    }
    return step;
  }

  /** The degree of the right note at a place, in its key. */
  private note(place: number): number {
    while (this.melody.length < place) {
      const next = this.melody.length + 1;
      const key = keyAt(next);
      const before = this.melody.at(-1);
      this.melody.push(
        before === undefined
          ? closestDegree(key, MELODY_CENTER)
          : moved(
              key,
              closestDegree(key, pitchOf(keyAt(next - 1), before)),
              digitAt(next) - digitAt(next - 1),
            ),
      );
    }
    return this.melody[place - 1] ?? 0;
  }

  private next(place: number): Step {
    const key = keyAt(place);
    const before = this.steps.at(-1);
    const degree = this.note(place);
    const previous = before?.key === key ? before.chord : undefined;
    return {
      key,
      degree,
      chord:
        previous !== undefined && inChord(previous, degree)
          ? previous
          : this.pickChord(place, key, degree, previous),
    };
  }

  /** The chord a note at a place moves to: see {@link Song}. */
  private pickChord(
    place: number,
    key: number,
    note: number,
    previous: number | undefined,
  ): number {
    const fits = (root: number): number => {
      let count = 0;
      for (let ahead = place + 1; ahead <= place + LOOKAHEAD && keyAt(ahead) === key; ahead++) {
        if (!inChord(root, this.note(ahead))) {
          break;
        }
        count++;
      }
      return count;
    };
    const follows = (root: number): number => {
      if (previous === undefined) {
        return root === 0 ? 1 : 0;
      }
      const rank = NEXT[previous]?.indexOf(root) ?? -1;
      return rank < 0 ? 0 : 1 - rank / 10;
    };
    const scored = CHORDS.filter((root) => inChord(root, note)).map((root) => ({
      root,
      score: fits(root) * 10 + follows(root),
    }));
    const best = Math.max(...scored.map(({ score }) => score));
    const level = scored.filter(({ score }) => score === best);
    return level[digitAt(place) % level.length]?.root ?? 0;
  }
}

/** The degree of a key's scale whose pitch is closest to `pitch`, the lower one if two are. */
function closestDegree(key: number, pitch: number): number {
  let degree = Math.floor(((pitch - 60 - key) * DEGREES) / 12);
  while (pitchOf(key, degree + 1) <= pitch) {
    degree++;
  }
  while (pitchOf(key, degree) > pitch) {
    degree--;
  }
  return pitch - pitchOf(key, degree) <= pitchOf(key, degree + 1) - pitch ? degree : degree + 1;
}

/** The degree the melody moves to from `degree` as the digit changes by `change`: see {@link Song}. */
function moved(key: number, degree: number, change: number): number {
  const move = Math.sign(change) * Math.min(LONGEST_MOVE, Math.ceil(Math.abs(change) / 3));
  const pitch = pitchOf(key, degree + move);
  return pitch < MELODY_LOW || pitch > MELODY_HIGH ? degree - move : degree + move;
}

/** The pitches of the notes of a chord, each just under `top`. */
function chordUnder(key: number, root: number, top: number): number[] {
  return [0, 2, 4]
    .map((above) => {
      let degree = root + above + 7 * DEGREES;
      while (pitchOf(key, degree) >= top) {
        degree -= DEGREES;
      }
      return pitchOf(key, degree);
    })
    .sort((a, b) => a - b);
}

/** The pitch of a chord's note closest to `target`, between the low notes' bounds; the lower one if two are. */
function bassNear(key: number, root: number, target: number): number {
  const pitches = [0, 2, 4].flatMap((above) =>
    [-3, -2, -1, 0, 1].map((octave) => pitchOf(key, root + above + octave * DEGREES)),
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

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Aria, the first sound model. At each place, the keys play the scale going up from 0 to 9, like a piano's keys from
 * left to right, slid so that the right digit plays the song's note (see {@link Song}): the wrong ones play the notes
 * next to it, mostly out of the chord, a little off. The key moves a fifth each season.
 *
 * The player's words shape how it's played, never its notes. A word's first digit has the whole chord under it, and a
 * low note; the chord thins out over the word's slots, down to the bare note on the last one, so each word sounds like a
 * phrase, and stretches as slots are added. The low notes opening the words go down a step from one word to the next
 * where the chord lets them, and back up once low. Words land in pairs, like a question and its answer: the first on the
 * open chord (V), the second on the closed one (I).
 */
class Aria implements SoundModel {
  private readonly song = new Song();

  keys({ place, words, slots }: Moment): Readonly<Record<Digit, Chime>> {
    const step = this.song.at(place);
    const right = digitAt(place);
    const under = this.texture(place, words, slots, step);
    return Object.fromEntries(
      DIGITS.map((digit): [Digit, Chime] => [
        digit,
        [
          { pitch: pitchOf(step.key, step.degree + Number(digit) - right), gain: MELODY_GAIN },
          ...under,
        ],
      ]),
    ) as Record<Digit, Chime>;
  }

  landing(words: readonly number[]): Chime {
    const step = this.song.at(Math.max(1, sum(words)));
    const root = words.length % 2 === 1 ? QUESTION : ANSWER;
    const base =
      root +
      DEGREES * Math.round((rootBetween(step.key, root, 58, 70) - pitchOf(step.key, root)) / 12);
    return [
      { pitch: rootBetween(step.key, root, BASS_LOW, BASS_HIGH), gain: BASS_GAIN },
      ...[0, 2, 4, 7].map((above) => ({
        pitch: pitchOf(step.key, base + above),
        gain: LANDING_GAIN,
      })),
    ].map((note, i) => ({ ...note, accompaniment: true as const, delay: i * ROLL }));
  }

  /** What sounds under the right note of a place, the same whatever key is typed: the chord, thinning over the word. */
  private texture(place: number, words: readonly number[], slots: number, step: Step): Note[] {
    const index = place - 1 - sum(words);
    const size = Math.max(slots, index + 1);
    const fullness = size <= 1 ? 1 : 1 - index / (size - 1);
    const count = index === 0 ? CHORD_TONES : Math.round(CHORD_TONES * fullness);
    const chord: Note[] = chordUnder(step.key, step.chord, pitchOf(step.key, step.degree))
      .slice(CHORD_TONES - count)
      .map((pitch) => ({
        pitch,
        gain: CHORD_GAIN * (0.4 + 0.6 * fullness),
        accompaniment: true,
      }));
    return index === 0
      ? [{ pitch: this.bass(words), gain: BASS_GAIN, accompaniment: true }, ...chord]
      : chord;
  }

  /** The low note opening the word after `words`: see {@link Aria}. */
  private bass(words: readonly number[]): number {
    let start = 1;
    let bass: number | undefined;
    for (const size of [...words, 0]) {
      const step = this.song.at(start);
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
    'The keys play the scale, slid so that the right digit plays the song of π, its chords fitting the notes coming; the words phrase it.',
  create: () => new Aria(),
};
