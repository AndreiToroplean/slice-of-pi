/** How loud the game plays, how loud the chords under the melody are, and how long a note rings. */
export interface SoundMix {
  /** The volume of it all, from 0 to 1. */
  readonly volume: number;
  /** The volume of the chords and low notes, from 0 to 1, as a share of the melody's. */
  readonly chords: number;
  /** How long a note takes to fade out, in seconds. */
  readonly length: number;
}

/** The game's own mix. */
export const SOUND_MIX: SoundMix = { volume: 0.6, chords: 0.6, length: 1.2 };

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
  { key: 'volume', label: 'Volume', min: 0, max: 1, step: 0.05, format: percent },
  { key: 'chords', label: 'Chords', min: 0, max: 1, step: 0.05, format: percent },
  {
    key: 'length',
    label: 'Note Length',
    min: 0.2,
    max: 3,
    step: 0.1,
    format: (value) => `${value.toFixed(1)} s`,
  },
];
