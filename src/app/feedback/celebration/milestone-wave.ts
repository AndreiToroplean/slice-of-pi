import { GAME_VALUES } from '../../game-values';
import { SoundSlider } from '../sound-mix';

/**
 * A wave of color celebrating a milestone, up the screen's edges: one value, made at the bottom of the screen as a sine
 * times a strength that fades to nothing, carried up the edges, faster and faster. Its sign tips the color's hue either
 * way round the milestone's color, and the further from 0 it is, the more it shows, only in a gradient from the edges in.
 */
export interface MilestoneWave {
  /** How many crests the sine makes a second, at the bottom. */
  readonly frequency: number;
  /** How long it lasts at the bottom, in seconds. */
  readonly duration: number;
  /** How the first time's strength fades over its duration: the higher, the faster at first. */
  readonly decay: number;
  /** Its strength at its strongest. */
  readonly peak: number;
  /** How fast it starts climbing, in screen heights a second. */
  readonly speed: number;
  /** How fast its climb speeds up, in screen heights a second, each second. */
  readonly acceleration: number;
  /** How far in from the edges it shows, in the screen's shorter side. */
  readonly depth: number;
  /** How the gradient fades in from the edges: the higher, the closer to them. */
  readonly falloff: number;
  /** How far its value tips the hue round the milestone's color, in degrees, at a value of 1. */
  readonly hue: number;
  /** How far the hue shimmers along the edges, in degrees. */
  readonly shimmer: number;
  /** How much its color shows, at a value of 1. */
  readonly glow: number;
  /** How far it bends the screen under it, inward, at a value of 1, in the screen's size. */
  readonly distortion: number;
  /** How far apart it splits the screen's red and blue under it, at a value of 1, in the screen's size. */
  readonly colorSplit: number;
}

/** The wave of the first time a milestone is ever reached: crests fading out, the first the strongest. */
export const FIRST_MILESTONE_WAVE: MilestoneWave = GAME_VALUES.firstMilestoneWave;
/** The wave of every other time: one pulse, short and subtle. */
export const MILESTONE_WAVE: MilestoneWave = GAME_VALUES.milestoneWave;

const plain =
  (digits: number, unit = '') =>
  (value: number): string =>
    `${value.toFixed(digits)}${unit}`;

/** The sliders of a milestone wave, in order. */
export const MILESTONE_WAVE_SLIDERS: readonly SoundSlider<MilestoneWave>[] = [
  { key: 'frequency', label: 'Frequency', min: 0.5, max: 8, step: 0.05, format: plain(2, ' Hz') },
  { key: 'duration', label: 'Duration', min: 0.1, max: 6, step: 0.01, format: plain(2, ' s') },
  { key: 'decay', label: 'Decay', min: 0.3, max: 4, step: 0.05, format: plain(2) },
  { key: 'peak', label: 'Peak', min: 0.1, max: 2, step: 0.01, format: plain(2) },
  { key: 'speed', label: 'Speed', min: 0.05, max: 3, step: 0.01, format: plain(2) },
  { key: 'acceleration', label: 'Acceleration', min: 0, max: 12, step: 0.1, format: plain(1) },
  { key: 'depth', label: 'Depth', min: 0.03, max: 0.8, step: 0.005, format: plain(3) },
  { key: 'falloff', label: 'Falloff', min: 0.5, max: 6, step: 0.05, format: plain(2) },
  { key: 'hue', label: 'Hue', min: 0, max: 90, step: 1, format: plain(0, '°') },
  { key: 'shimmer', label: 'Shimmer', min: 0, max: 60, step: 1, format: plain(0, '°') },
  { key: 'glow', label: 'Glow', min: 0, max: 3, step: 0.01, format: plain(2) },
  { key: 'distortion', label: 'Distortion', min: 0, max: 0.2, step: 0.001, format: plain(3) },
  { key: 'colorSplit', label: 'Color Split', min: 0, max: 0.03, step: 0.0005, format: plain(4) },
];

/** How long the wave takes to climb `height` screen heights from the bottom, speeding up as it goes, in seconds. */
export function climbTime(wave: MilestoneWave, height: number): number {
  const { speed, acceleration } = wave;
  return acceleration < 1e-3
    ? height / speed
    : (-speed + Math.sqrt(speed * speed + 2 * acceleration * height)) / acceleration;
}

/**
 * The wave's value at the bottom, `elapsed` seconds after it started, 0 outside its duration. The first time, a sine
 * whose strength rises at once to its peak and fades from there to nothing; every other time, one pulse, a sine under a
 * window rising and falling over the duration, its crest halfway.
 */
export function waveValue(wave: MilestoneWave, first: boolean, elapsed: number): number {
  const { duration, frequency, peak } = wave;
  if (elapsed < 0 || elapsed > duration) {
    return 0;
  }
  const done = elapsed / duration;
  if (first) {
    return (
      peak * rise(elapsed) * (1 - done) ** wave.decay * Math.cos(2 * Math.PI * frequency * elapsed)
    );
  }
  return (
    peak *
    Math.sin(Math.PI * done) ** 2 *
    Math.cos(2 * Math.PI * frequency * (elapsed - duration / 2))
  );
}

/** How long the first time's strength takes to rise to its peak, in seconds: at once, but without a click of light. */
export const RISE = 0.06;

/** The first time's strength rising to its peak over {@link RISE}, smoothly. */
function rise(elapsed: number): number {
  const x = Math.min(1, elapsed / RISE);
  return x * x * (3 - 2 * x);
}

/** How long the wave lasts on the screen, in seconds: until its end has climbed to the top. */
export function waveLifetime(wave: MilestoneWave): number {
  return climbTime(wave, 1) + wave.duration;
}
