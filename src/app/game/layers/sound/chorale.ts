import { DIGITS, Digit } from '../../pi/digit';
import { nameOf } from './aria';
import { Chime, Moment, Note, SoundModel, SoundModelKind } from './sound-model';

/**
 * The note of each digit, as a MIDI note number (60 is middle C): C major going up a step a digit, from C4 for 0 to E5
 * for 9, so that digits next to each other are notes next to each other, and π's melody moves by steps as much as it
 * can. Any note of the scale fits some chord, so none needs leaving out.
 */
export const CHORALE_PITCHES: readonly number[] = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76];

/** The chords, by their Roman numeral in C major: the six triads, two sevenths, and the dominants of V and vi. */
export type ChordName = 'I' | 'ii' | 'ii7' | 'iii' | 'IV' | 'V' | 'V7' | 'vi' | 'V/V' | 'V/vi';

interface Chord {
  /** As players read it, as G7. */
  readonly symbol: string;
  /** Its notes as pitch classes (0 is C), from its root: root, third, fifth, and seventh if any. */
  readonly tones: readonly number[];
  /** A note never doubled: the leading tone, pulling up to the chord it leads to. */
  readonly leading?: number;
  /** How much less it's picked than the others, as weaker or more colorful. */
  readonly rarity?: number;
}

const CHORDS: Readonly<Record<ChordName, Chord>> = {
  I: { symbol: 'C', tones: [0, 4, 7] },
  ii: { symbol: 'Dm', tones: [2, 5, 9] },
  ii7: { symbol: 'Dm7', tones: [2, 5, 9, 0], rarity: 0.3 },
  iii: { symbol: 'Em', tones: [4, 7, 11], rarity: 0.5 },
  IV: { symbol: 'F', tones: [5, 9, 0] },
  V: { symbol: 'G', tones: [7, 11, 2], leading: 11 },
  V7: { symbol: 'G7', tones: [7, 11, 2, 5], leading: 11, rarity: 0.3 },
  vi: { symbol: 'Am', tones: [9, 0, 4] },
  'V/V': { symbol: 'D', tones: [2, 6, 9], leading: 6, rarity: 0.5 },
  'V/vi': { symbol: 'E', tones: [4, 8, 11], leading: 8, rarity: 0.5 },
};
/** The chords in the order ties are settled in, the plainest first. */
const CHORD_NAMES = Object.keys(CHORDS) as ChordName[];

/**
 * How well each chord leads to each other, the common practice of tonal music in numbers: towards the dominant (V)
 * and home from it strongest, round the circle of fifths (vi, ii, V, I) strong, backwards (V to IV) weak. The dominant
 * of a chord leads to it alone. A move not listed is worth {@link UNLISTED}.
 */
const NEXT: Readonly<Record<ChordName, Partial<Record<ChordName, number>>>> = {
  I: { ii: 1, ii7: 1, iii: 0, IV: 2, V: 2, V7: 1.5, vi: 1.5, 'V/V': 0.5, 'V/vi': 0.5 },
  ii: { I: -1, ii7: 1, iii: -1, IV: 0, V: 3, V7: 3, vi: 0, 'V/V': 0 },
  ii7: { I: -1, ii: -1, iii: -1, IV: 0, V: 3, V7: 3, vi: 0 },
  iii: { I: -1, ii: 0, ii7: 0, IV: 1.5, V: 0, V7: 0, vi: 2.5, 'V/vi': 0 },
  IV: { I: 1.5, ii: 1, ii7: 1, iii: -1, V: 3, V7: 2.5, vi: 0.5, 'V/V': 1 },
  V: { I: 3, ii: -2, ii7: -2, iii: -0.5, IV: -1, V7: 1.5, vi: 2 },
  V7: { I: 3.5, iii: -1, IV: -2, V: -2, vi: 2 },
  vi: { I: 0, ii: 2, ii7: 2, iii: 0, IV: 2.5, V: 1, V7: 0.5, 'V/V': 1, 'V/vi': 0.5 },
  'V/V': { V: 4, V7: 4 },
  'V/vi': { vi: 4, IV: 0 },
};
const UNLISTED = -3;

/** How well a chord fits the melody's note, by the note's place in it: root, third, fifth or seventh. */
const FIT = [1.5, 1, 0.5, 0.5] as const;
/** How well a chord kept under a passing note fits it: worse than any of its own notes. */
const PASSING = -1;

/** How many places a chord may last before it's wanted less for each more. */
const FRESH = 4;
type Cadence = Partial<Record<ChordName, number>>;
/**
 * How much each chord is wanted on a word's first slot, and on its last ones, counted from its end, by whether it asks
 * or answers: a phrase opens on the tonic (I), the question ends on the dominant (V), a half cadence, and the answer on
 * V then I, a full one, after the chords leading to V.
 */
const OPENINGS: Readonly<Record<'question' | 'answer', Cadence>> = {
  question: { I: 1.5 },
  answer: { I: 0.5, vi: 0.5 },
};
const ENDINGS: Readonly<Record<'question' | 'answer', readonly Cadence[]>> = {
  question: [
    { V: 2.5, V7: 1.5 },
    { V: 1.5, V7: 1 },
  ],
  answer: [{ I: 6 }, { V: 2, V7: 2 }, { IV: 1, ii: 1, ii7: 1, 'V/V': 0.5 }],
};
/** How many of an answer's last slots a chord's lowest note is its root on, as a cadence's chords are. */
const ROOTED = 2;

/**
 * Where a place falls in the player's words, which are the song's bars: its slot in its word, from 0, the word's size,
 * and whether the word answers the one before, the words going in pairs, a question and its answer.
 */
export interface Meter {
  readonly slot: number;
  readonly size: number;
  readonly answer: boolean;
}

/**
 * The meter of the first `count` places, in the finished `words`, then in the word being typed, of `slots`, or as many
 * as it holds past them.
 */
export function metersOf(count: number, words: readonly number[], slots: number): Meter[] {
  const meters: Meter[] = [];
  for (const [word, size] of [...words, Infinity].entries()) {
    const left = count - meters.length;
    const actual = size === Infinity ? Math.max(slots, left) : size;
    for (let slot = 0; slot < Math.min(actual, left); slot++) {
      meters.push({ slot, size: actual, answer: word % 2 === 1 });
    }
    if (meters.length >= count) {
      break;
    }
  }
  return meters;
}

/** How many slots of its word are left after a place's. */
function fromEnd({ slot, size }: Meter): number {
  return size - 1 - slot;
}

/** How much a chord is wanted at a place, for where it falls in its word and its pair. */
function cadence(name: ChordName, meter: Meter): number {
  const kind = meter.answer ? 'answer' : 'question';
  const opening = meter.slot === 0 ? (OPENINGS[kind][name] ?? 0) : 0;
  const ending =
    meter.slot > 0 || meter.size === 1 ? (ENDINGS[kind][fromEnd(meter)]?.[name] ?? 0) : 0;
  return opening + ending;
}

type Beat = 'strong' | 'medium' | 'weak';
/**
 * How much changing chord, or keeping it, is wanted on each beat: changes fall on the strong ones, as in songs, and at
 * the end of a word, where its cadence falls.
 */
const CHANGE: Readonly<Record<Beat, number>> = { strong: 1, medium: 0, weak: -1.5 };
const HOLD: Readonly<Record<Beat, number>> = { strong: -0.5, medium: 2, weak: 4 };
/** How much less a chord is wanted for each place it's kept past {@link FRESH}, and going back to the one before it. */
const STALE = 2;
const BACK = 0.75;

/** Where the voices under the melody may go, as MIDI note numbers. */
const BASS = { low: 40, high: 55, center: 47 } as const;
const TENOR = { low: 48, high: 65 } as const;
const ALTO = { low: 55, high: 72 } as const;
/** How far apart, at most, the alto may be from the melody and the tenor from the alto: an octave. */
const SPAN = 12;

/** How loud the melody is, on a downbeat and off it, and the bass and the voices between. */
const DOWNBEAT_GAIN = 0.85;
const MELODY_GAIN = 0.72;
const BASS_GAIN = 0.75;
const VOICE_GAIN = 0.45;
/** How much softer a chord is struck again on a downbeat while it's kept. */
const RESTRUCK = 0.7;
/** How long the melody and the chords under it ring, in seconds, and longer as a phrase comes home. */
const MELODY_LENGTH = 1.1;
const CHORD_LENGTH = 2;
const HOME_MELODY_LENGTH = 1.6;
const HOME_CHORD_LENGTH = 2.8;
/** How long after each other the voices under the melody start, from the bass up, in seconds, as a harp rolls them. */
const ROLL = 0.015;

/** The harmony at a place: its chord, how it got there, and the voices singing it. */
export interface Harmony {
  readonly chord: ChordName;
  /** The last chord before it, other than itself, if any. */
  readonly before: ChordName | undefined;
  /** How many places it has sounded, this one included. */
  readonly held: number;
  /** The melody's note: the digit's. */
  readonly melody: number;
  /** The voices under the melody, lowest first: the bass, the tenor and the alto. */
  readonly voices: readonly [number, number, number];
  /** Whether the voices are struck at this place, rather than left ringing from before. */
  readonly struck: boolean;
}

function mod(value: number, by: number): number {
  return ((value % by) + by) % by;
}

/** A place's beat: a word's first slot is its downbeat, its last a cadence, and those between alternate. */
function beatOf(meter: Meter): Beat {
  return meter.slot === 0
    ? 'strong'
    : meter.slot % 2 === 0 || fromEnd(meter) === 0
      ? 'medium'
      : 'weak';
}

/**
 * Whether the melody's `pitch` may pass over the chord before without changing it, though not one of its notes: on a
 * weak beat, a step from a note of the chord, as a passing or a neighbor tone.
 */
function passing(pitch: number, beat: Beat, previous: Harmony): boolean {
  const step = Math.abs(pitch - previous.melody);
  return (
    beat === 'weak' &&
    step > 0 &&
    step <= 2 &&
    CHORDS[previous.chord].tones.includes(mod(previous.melody, 12))
  );
}

/**
 * How much a chord is wanted under the melody's `pitch` at `meter`, after `previous`; undefined if it doesn't hold the
 * note, unless the note passes over it (see {@link passing}).
 */
function harmonyScore(
  name: ChordName,
  pitch: number,
  meter: Meter,
  previous: Harmony | undefined,
): number | undefined {
  const chord = CHORDS[name];
  const role = chord.tones.indexOf(mod(pitch, 12));
  const beat = beatOf(meter);
  if (role < 0) {
    return name === previous?.chord && passing(pitch, beat, previous)
      ? PASSING + HOLD[beat] - STALE * Math.max(0, previous.held + 1 - FRESH)
      : undefined;
  }
  let score = (FIT[role] ?? 0) - (chord.rarity ?? 0) + cadence(name, meter);
  if (previous === undefined) {
    return score;
  }
  if (name === previous.chord) {
    score += HOLD[beat] - STALE * Math.max(0, previous.held + 1 - FRESH);
  } else {
    score += CHANGE[beat] + (NEXT[previous.chord][name] ?? UNLISTED);
    if (name === previous.before) {
      score -= BACK;
    }
  }
  return score;
}

/** The chord under the melody's `pitch` at `meter`, after `previous`: the most wanted that holds the note. */
function chordFor(pitch: number, meter: Meter, previous: Harmony | undefined): ChordName {
  let best: ChordName = 'I';
  let bestScore = -Infinity;
  for (const name of CHORD_NAMES) {
    const score = harmonyScore(name, pitch, meter, previous);
    if (score !== undefined && score > bestScore) {
      best = name;
      bestScore = score;
    }
  }
  return best;
}

/** The pitches from `low` to `high` whose pitch classes are among `classes`. */
function within(low: number, high: number, classes: readonly number[]): number[] {
  const pitches: number[] = [];
  for (let pitch = low; pitch <= high; pitch++) {
    if (classes.includes(mod(pitch, 12))) {
      pitches.push(pitch);
    }
  }
  return pitches;
}

/**
 * Whether two voices moving from `before` to `after` go in parallel fifths or octaves, which the rules forbid: both
 * moving the same way, a fifth or an octave apart (or a unison) before and after.
 */
export function parallel(
  before: readonly [number, number],
  after: readonly [number, number],
): boolean {
  const interval = (pair: readonly [number, number]): number => mod(pair[1] - pair[0], 12);
  const together = Math.sign(after[0] - before[0]) * Math.sign(after[1] - before[1]) > 0;
  const perfect = interval(after) === 0 || interval(after) === 7;
  return together && perfect && interval(before) === interval(after);
}

/**
 * How badly a voicing sings its chord under the melody, by the rules of four-part writing: every voice moves as little
 * as it can, the bass a little more freely; the chord's root and third are there, its seventh too, its fifth if it
 * can be; no voice doubles the third, the seventh or the leading tone; no two voices move in parallel fifths or
 * octaves; and the bass sings the root, or the third at a pinch, never at a cadence.
 */
function voicingCost(
  chord: Chord,
  voices: readonly [number, number, number],
  melody: number,
  meter: Meter,
  previous: Harmony | undefined,
): number {
  const [bass, tenor, alto] = voices;
  const all = [bass, tenor, alto, melody];
  const count = (pitchClass: number | undefined): number =>
    all.filter((pitch) => mod(pitch, 12) === pitchClass).length;
  const [root, third, fifth, seventh] = chord.tones;
  if (count(root) === 0 || count(third) === 0 || (seventh !== undefined && count(seventh) === 0)) {
    return Infinity;
  }
  let cost = 0;
  if (count(fifth) === 0) {
    cost += 1.5;
  }
  if (count(third) > 1) {
    cost += chord.leading === third ? 20 : 2;
  }
  if (seventh !== undefined && count(seventh) > 1) {
    cost += 20;
  }
  if (chord.leading !== undefined && count(chord.leading) > 1) {
    cost += 20;
  }
  if (mod(bass, 12) !== root) {
    cost += meter.answer && fromEnd(meter) < ROOTED ? 6 : 1.5;
  }
  cost += 0.1 * Math.abs(bass - BASS.center);
  if (previous === undefined) {
    return cost + 0.3 * (Math.abs(tenor - (melody - 9)) + Math.abs(alto - (melody - 5)));
  }
  const [lastBass, lastTenor, lastAlto] = previous.voices;
  const steps = [Math.abs(tenor - lastTenor), Math.abs(alto - lastAlto)];
  cost += steps.reduce((total, step) => total + step + (step > 4 ? 2 : 0), 0);
  const leap = Math.abs(bass - lastBass);
  cost += 0.4 * leap + (leap > 7 ? 2 : 0);
  const last = [lastBass, lastTenor, lastAlto, previous.melody];
  for (let low = 0; low < all.length; low++) {
    for (let high = low + 1; high < all.length; high++) {
      const before = [last[low] ?? 0, last[high] ?? 0] as const;
      if (parallel(before, [all[low] ?? 0, all[high] ?? 0])) {
        cost += 100;
      }
    }
  }
  return cost;
}

/** The best voicing of a chord under the melody, after `previous`: see {@link voicingCost}. */
function voicingFor(
  name: ChordName,
  melody: number,
  meter: Meter,
  previous: Harmony | undefined,
): [number, number, number] {
  const chord = CHORDS[name];
  const [root = 0, third = 4] = chord.tones;
  let best: [number, number, number] = [
    BASS.low + mod(root - BASS.low, 12),
    melody - 8,
    melody - 5,
  ];
  let bestCost = Infinity;
  for (const bass of within(BASS.low, BASS.high, [root, third])) {
    for (const alto of within(
      Math.max(ALTO.low, melody - SPAN),
      Math.min(ALTO.high, melody - 1),
      chord.tones,
    )) {
      for (const tenor of within(
        Math.max(TENOR.low, alto - SPAN, bass + 1),
        Math.min(TENOR.high, alto - 1),
        chord.tones,
      )) {
        const cost = voicingCost(chord, [bass, tenor, alto], melody, meter, previous);
        if (cost < bestCost) {
          best = [bass, tenor, alto];
          bestCost = cost;
        }
      }
    }
  }
  return best;
}

/**
 * The harmony under the digit at `meter`, after `previous`: the chord most wanted under its note (see
 * {@link harmonyScore}), and the voices, kept ringing while the chord is kept and they stay under the melody, else
 * moved to it as smoothly as they can (see {@link voicingCost}).
 */
export function harmonize(digit: number, meter: Meter, previous: Harmony | undefined): Harmony {
  const melody = CHORALE_PITCHES[digit] ?? 60;
  const chord = chordFor(melody, meter, previous);
  if (chord === previous?.chord && previous.voices[2] < melody) {
    return { ...previous, held: previous.held + 1, melody, struck: false };
  }
  return {
    chord,
    before: previous === undefined || previous.chord === chord ? previous?.before : previous.chord,
    held: previous?.chord === chord ? previous.held + 1 : 1,
    melody,
    voices: voicingFor(chord, melody, meter, previous),
    struck: true,
  };
}

/**
 * The harmony at each place of `typed`, in `words` of those sizes, worked out in order from the first, each from the
 * digits and words up to it alone.
 */
export function harmonizeAll(typed: string, words: readonly number[]): Harmony[] {
  const harmonies: Harmony[] = [];
  for (const [index, meter] of metersOf(typed.length, words, 0).entries()) {
    harmonies.push(harmonize(Number(typed[index]), meter, harmonies.at(-1)));
  }
  return harmonies;
}

/** Whether a phrase comes home at `meter`: on the tonic, at the end of an answer. */
function home(harmony: Harmony, meter: Meter): boolean {
  return harmony.chord === 'I' && meter.answer && fromEnd(meter) === 0;
}

/** A meter for a place outside any word, never used: the first slot of a question of one. */
const FIRST: Meter = { slot: 0, size: 1, answer: false };

function sameMeter(a: Meter | undefined, b: Meter | undefined): boolean {
  return a?.slot === b?.slot && a?.size === b?.size && a?.answer === b?.answer;
}

/**
 * Chorale, a sound model that harmonizes π's melody as a chorale is, in four voices. See {@link CHORALE}'s `about` for
 * how it plays, which developer mode shows.
 */
class Chorale implements SoundModel {
  /**
   * The digits typed last asked about, the meter and the harmony at each of their places, kept while they stay the
   * same.
   */
  private typed = '';
  private meters: Meter[] = [];
  private readonly harmonies: Harmony[] = [];

  keys({ typed, words, slots }: Moment): Readonly<Record<Digit, Chime>> {
    const { previous, meter } = this.after(typed, words, slots);
    return Object.fromEntries(
      DIGITS.map((digit): [Digit, Chime] => [
        digit,
        this.chime(harmonize(Number(digit), meter, previous), meter),
      ]),
    ) as Record<Digit, Chime>;
  }

  describe({ typed, words, slots }: Moment, digit: Digit): string {
    const { previous, meter } = this.after(typed, words, slots);
    const harmony = harmonize(Number(digit), meter, previous);
    const [bass] = harmony.voices;
    const under = harmony.struck ? `bass ${nameOf(bass)}` : 'held';
    return `${digit} ${nameOf(harmony.melody)} on ${CHORDS[harmony.chord].symbol} (${harmony.chord}) · ${under} · slot ${String(meter.slot + 1)}/${String(meter.size)} ${meter.answer ? 'answer' : 'question'}`;
  }

  landing(): Chime {
    return [];
  }

  describeLanding(): string {
    return 'silent';
  }

  /**
   * The harmony at the last place of `typed`, worked out from where it or its meter last differed, and the meter of
   * the place after it.
   */
  private after(
    typed: string,
    words: readonly number[],
    slots: number,
  ): { previous: Harmony | undefined; meter: Meter } {
    const meters = metersOf(typed.length + 1, words, slots);
    let same = 0;
    while (
      same < typed.length &&
      same < this.typed.length &&
      typed[same] === this.typed[same] &&
      sameMeter(meters[same], this.meters[same])
    ) {
      same++;
    }
    this.harmonies.length = Math.min(this.harmonies.length, same);
    this.typed = typed;
    this.meters = meters;
    while (this.harmonies.length < typed.length) {
      const index = this.harmonies.length;
      this.harmonies.push(
        harmonize(Number(typed[index]), meters[index] ?? FIRST, this.harmonies.at(-1)),
      );
    }
    return { previous: this.harmonies.at(-1), meter: meters.at(-1) ?? FIRST };
  }

  /**
   * What a place plays: the melody's note, louder on a downbeat, and the voices under it where they're struck, or
   * struck again softer on a downbeat while the chord is kept; all longer as a phrase comes home.
   */
  private chime(harmony: Harmony, meter: Meter): Chime {
    const isHome = home(harmony, meter);
    const downbeat = meter.slot === 0;
    const melody: Note = {
      pitch: harmony.melody,
      gain: downbeat ? DOWNBEAT_GAIN : MELODY_GAIN,
      length: isHome ? HOME_MELODY_LENGTH : MELODY_LENGTH,
    };
    if (!harmony.struck && !downbeat) {
      return [melody];
    }
    const softer = harmony.struck ? 1 : RESTRUCK;
    return [
      melody,
      ...harmony.voices.map((pitch, i): Note => ({
        pitch,
        gain: (i === 0 ? BASS_GAIN : VOICE_GAIN) * softer,
        length: isHome ? HOME_CHORD_LENGTH : CHORD_LENGTH,
        accompaniment: true,
        delay: i * ROLL,
      })),
    ];
  }
}

export const CHORALE: SoundModelKind = {
  id: 'chorale',
  label: 'Chorale',
  about: [
    'Each digit always plays its own note: C major going up a step a digit, from C4 for 0 to E5 for 9. Its melody is π’s, and Chorale harmonizes it, as a hymn tune is, in four voices: the melody on top, then alto, tenor and bass.',
    'Under each note, it picks a chord holding that note, the one music theory wants most there: one that follows the chord before naturally (towards G and back home to C strongest, round the circle of fifths strong, backwards weak), with the note as its root rather than its fifth, and with a little color now and then (Dm7, G7, and the D and E leading to G and Am).',
    'Your words are its bars, so that π plays to your own rhythm. Each word opens on a strong beat, where chords change, and they stay on the weak ones between. Words go in pairs, a question and its answer: the question opens on C and ends on G, the answer ends on G then C, on its last slots, whatever its size, wherever the melody lets it.',
    'The voices under the melody move as little as they can to the next chord, by the rules of four-part writing: no parallel fifths or octaves, no doubled leading tone. They ring while the chord stays, and are struck again on each word’s first digit.',
    'It plays nothing as words land, and ignores the colors and the seasons: only the digits and your words make the music.',
    'It never knows π: only the digits typed before, and the one typed, so a key sounds the same, right or wrong.',
  ],
  create: () => new Chorale(),
};
