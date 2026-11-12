import { SoundSlider } from '../../../feedback/sound-mix';
import { KeyMotion } from './key-merges';

const milliseconds = (value: number): string => `${String(Math.round(value))} ms`;

/** The sliders of the keypad's keys' motion. */
export const KEY_MOTION_SLIDERS: readonly SoundSlider<KeyMotion>[] = [
  { key: 'press', label: 'Press', min: 0, max: 1000, step: 10, format: milliseconds },
  { key: 'merge', label: 'Merge', min: 0, max: 1000, step: 10, format: milliseconds },
];
