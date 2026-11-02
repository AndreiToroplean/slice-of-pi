/** How loud the chords under the melody are: the rest is the sound model's, and the phone's volume. */
export interface SoundMix {
  /** The volume of the chords and low notes, from 0 to 1, as a share of the melody's. */
  readonly chords: number;
}

/** The game's own mix. */
export const SOUND_MIX: SoundMix = { chords: 0.6 };

/** A setting of the mix, as its slider shows it on the sounds page. */
export interface MixSlider {
  readonly key: keyof SoundMix;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly format: (value: number) => string;
}

const percent = (value: number): string => `${String(Math.round(value * 100))}%`;

/** The sliders of the mix, in order. */
export const MIX_SLIDERS: readonly MixSlider[] = [
  { key: 'chords', label: 'Chords', min: 0, max: 1, step: 0.05, format: percent },
];
