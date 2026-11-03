import { SoundSlider } from './sound-mix';

/**
 * How a wrong key's note goes off as it rings, once typed, rather than played again: the same for every note, whatever
 * the sound model. It sags out of tune against the chord under it, which holds, its harmonics drift apart and beat,
 * and it turns into a buzzer, harsh and rasping, as a wrong answer's on a game show.
 */
export interface Souring {
  /** How far its pitch sags, in cents, 100 to a semitone: negative goes down. */
  readonly bend: number;
  /** How far its harmonics drift apart, in cents: the nth by n - 1 times this, so that they beat. */
  readonly drift: number;
  /** How loud the buzz it turns into is, from 0 to 1: a square wave at its pitch, harsh with odd harmonics. */
  readonly buzz: number;
  /** How deep the rasp is, from 0 to 1: its volume fluttering fast, as a buzzer's. */
  readonly rasp: number;
  /** How long it takes to go off, in seconds. */
  readonly speed: number;
}

/** The game's own souring. */
export const SOURING: Souring = { bend: -70, drift: 12, buzz: 0.5, rasp: 0.5, speed: 0.15 };

const cents = (value: number): string => `${String(Math.round(value))}¢`;
const percent = (value: number): string => `${String(Math.round(value * 100))}%`;
const milliseconds = (value: number): string => `${String(Math.round(value * 1000))} ms`;

/** The sliders of the souring, in order. */
export const SOURING_SLIDERS: readonly SoundSlider<Souring>[] = [
  { key: 'bend', label: 'Sag', min: -100, max: 0, step: 5, format: cents },
  { key: 'drift', label: 'Drift', min: 0, max: 30, step: 1, format: cents },
  { key: 'buzz', label: 'Buzz', min: 0, max: 1, step: 0.05, format: percent },
  { key: 'rasp', label: 'Rasp', min: 0, max: 1, step: 0.05, format: percent },
  { key: 'speed', label: 'Speed', min: 0, max: 0.5, step: 0.01, format: milliseconds },
];
