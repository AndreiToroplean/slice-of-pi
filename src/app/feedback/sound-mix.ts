/** How loud the chords under the melody are, and words as they land: the rest is the sound model's, and the phone's volume. */
export interface SoundMix {
  /** The volume of the chords and low notes, from 0 to 1, as a share of the melody's. */
  readonly chords: number;
  /** The volume of what words play as they land on the tape, from 0 to 1, as a share of the sound model's: 0 for none. */
  readonly landings: number;
}

/** The game's own mix. */
export const SOUND_MIX: SoundMix = { chords: 0.6, landings: 0 };

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
];
