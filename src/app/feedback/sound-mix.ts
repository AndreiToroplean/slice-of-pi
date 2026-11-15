import { GAME_VALUES } from '../game-values';
/**
 * How loud the chords under the melody are, and words as they land, how much louder low notes play, and how bright a
 * plain pluck is: the rest is the sound model's, and the phone's volume.
 */
export interface SoundMix {
  /** The volume of the chords and low notes, from 0 to 1, as a share of the melody's. */
  readonly chords: number;
  /** The volume of what words play as they land on the tape, from 0 to 1, as a share of the sound model's: 0 for none. */
  readonly landings: number;
  /**
   * How much louder notes under 1 kHz play, in decibels for each octave under it, as the ear hears low notes softer at
   * the same level, and a phone's small speakers play them softer still.
   */
  readonly lows: number;
  /**
   * How loud each partial of a plain pluck is next to the one under it, from 0 for its fundamental alone: a phone's
   * speakers, too small to play a low note's own pitch, play it through its higher partials.
   */
  readonly brightness: number;
}

/** The game's own mix. */
export const SOUND_MIX: SoundMix = GAME_VALUES.sound;

/** A setting of the speaker, such as of the mix, as its slider shows it on the Sound Models page. */
export interface SoundSlider<T> {
  readonly key: keyof T & string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly format: (value: number) => string;
}

const percent = (value: number): string => `${String(Math.round(value * 100))}%`;

/** The sliders of the mix, in order. */
export const MIX_SLIDERS: readonly SoundSlider<SoundMix>[] = [
  { key: 'chords', label: 'Chords', min: 0, max: 1, step: 0.05, format: percent },
  { key: 'landings', label: 'Landings', min: 0, max: 1, step: 0.05, format: percent },
  {
    key: 'lows',
    label: 'Lows',
    min: 0,
    max: 6,
    step: 0.5,
    format: (value) => `+${String(value)} dB/oct`,
  },
  { key: 'brightness', label: 'Brightness', min: 0, max: 0.6, step: 0.02, format: percent },
];
