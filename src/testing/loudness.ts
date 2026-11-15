import {
  envelopeCurve,
  frequencyOf,
  HEADROOM,
  LIMITER,
  mixedGain,
  partialLevels,
} from '../app/feedback/speaker';
import { SoundMix } from '../app/feedback/sound-mix';
import { Chime, Note } from '../app/game/layers/sound/sound-model';

/**
 * How the game's sound reaches the player, worked out from the notes rather than recorded, so that tests can tell how
 * loud it is on the systems it plays on, as the speaker plays it (see `Speaker`): each note a sum of sine waves, its
 * partials, through the speaker's level and the limiter's makeup gain, the limiter itself left out, as it only acts on
 * the rare loudest moments.
 */

/** What the player listens on: a phone's own speakers, or headphones, which play every pitch alike. */
export type Listening = 'phone' | 'headphones';

/**
 * Where a phone's speakers start rolling off, in hertz, 12 dB an octave lower down: too small to move much air, they
 * play little under a few hundred hertz. Phones differ, this is a typical one.
 */
const PHONE_CUTOFF = 600;
/**
 * How much softer the ear hears a note, in decibels for each octave under 1 kHz, as the 60-phon equal-loudness contour
 * has it between 250 Hz and 1 kHz, about (ISO 226); steeper lower down, where only chords go.
 */
const EAR_SLOPE = 3;
/**
 * The gain the browsers' compressor adds to all it plays, the limiter included, in decibels: as much as it takes off the
 * loudest sound, at full scale, to the power of 0.6.
 */
const MAKEUP = -0.6 * LIMITER.threshold * (1 - 1 / LIMITER.ratio);
/** How long the blocks loudness is measured over last, and how far apart they start, in ms (ITU-R BS.1770). */
const BLOCK = 400;
const BLOCK_STEP = 100;

/** How loud a phone's speakers play a frequency, next to headphones, as a gain. */
function speakerGain(frequency: number, listening: Listening): number {
  if (listening === 'headphones') {
    return 1;
  }
  const ratio = (frequency / PHONE_CUTOFF) ** 4;
  return Math.sqrt(ratio / (1 + ratio));
}

/** How loud the ear hears a frequency, next to 1 kHz, as a gain (see {@link EAR_SLOPE}). */
function earGain(frequency: number): number {
  return 10 ** ((-EAR_SLOPE * Math.max(0, Math.log2(1000 / frequency))) / 20);
}

/**
 * The gain of the K-weighting filter loudness is measured through (ITU-R BS.1770), at a frequency: a shelf lifting
 * the highs, as the head does, and a high-pass under the lowest bass. Its two stages at 48 kHz, worked out at the
 * frequency.
 */
function kWeighting(frequency: number): number {
  const stages = [
    {
      b: [1.53512485958697, -2.69169618940638, 1.19839281085285],
      a: [1, -1.69065929318241, 0.73248077421585],
    },
    { b: [1, -2, 1], a: [1, -1.99004745483398, 0.99007225036621] },
  ];
  const w = (2 * Math.PI * frequency) / 48000;
  const size = (c: readonly number[]): number => {
    const [c0 = 0, c1 = 0, c2 = 0] = c;
    const re = c0 + c1 * Math.cos(w) + c2 * Math.cos(2 * w);
    const im = -c1 * Math.sin(w) - c2 * Math.sin(2 * w);
    return Math.hypot(re, im);
  };
  return stages.reduce((gain, { b, a }) => (gain * size(b)) / size(a), 1);
}

/** The amplitudes of a note's partials at its full volume, as played, each weighted by `weight` at its frequency. */
function weightedPartials(
  note: Note,
  mix: SoundMix,
  weight: (frequency: number) => number,
): number[] {
  const frequency = frequencyOf(note.pitch);
  const gain = HEADROOM * mixedGain(note, 'key', mix) * 10 ** (MAKEUP / 20);
  return partialLevels(note.timbre, mix.brightness, frequency).map(
    (level, i) => gain * level * weight(frequency * (i + 1)),
  );
}

/** How loud the player hears a key's note at its full volume, in decibels, listening as said. */
export function heardLevel(note: Note, mix: SoundMix, listening: Listening): number {
  const amplitudes = weightedPartials(note, mix, (f) => earGain(f) * speakerGain(f, listening));
  return 10 * Math.log10(amplitudes.reduce((sum, amplitude) => sum + amplitude ** 2, 0));
}

/** Keys played one after the other: what each played, and when, in seconds. */
export type Song = readonly { readonly time: number; readonly chime: Chime }[];

/**
 * How loud a song of keys is, as its integrated loudness, in LUFS (ITU-R BS.1770): the mean power, K-weighted, of its
 * blocks loud enough to count. The power of notes playing together is the sum of theirs, as notes of other pitches,
 * or the same pitch started apart, add up on average.
 */
export function integratedLoudness(song: Song, mix: SoundMix): number {
  const power: number[] = [];
  for (const { time, chime } of song) {
    for (const note of chime) {
      const full = weightedPartials(note, mix, kWeighting).reduce((sum, a) => sum + a ** 2 / 2, 0);
      const start = Math.round((time + (note.delay ?? 0)) * 1000);
      for (const [i, level] of envelopeCurve(note.length, 1000).entries()) {
        power[start + i] = (power[start + i] ?? 0) + full * level ** 2;
      }
    }
  }
  const blocks: number[] = [];
  for (let start = 0; start + BLOCK <= power.length; start += BLOCK_STEP) {
    let sum = 0;
    for (let i = start; i < start + BLOCK; i++) {
      sum += power[i] ?? 0;
    }
    blocks.push(sum / BLOCK);
  }
  const loudness = (mean: number): number => -0.691 + 10 * Math.log10(mean);
  const average = (values: readonly number[]): number =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const audible = blocks.filter((block) => loudness(block) > -70);
  const gate = loudness(average(audible)) - 10;
  return loudness(average(audible.filter((block) => loudness(block) > gate)));
}
