import { GAME_VALUES } from '../game-values';
/** The events the phone vibrates on, each with its own pattern. */
export const VIBRATIONS = [
  'play',
  'button',
  'digit',
  'mistake',
  'backspace',
  'pluck',
  'landing',
  'turn',
  'spin',
] as const;

export type Vibration = (typeof VIBRATIONS)[number];

/**
 * How the phone vibrates, as the Vibration API takes it: durations in milliseconds, alternately buzzing and pausing,
 * starting with a buzz. Never empty.
 */
export type VibrationPattern = readonly number[];

export type VibrationPatterns = Readonly<Record<Vibration, VibrationPattern>>;

/** The game's own patterns. */
export const VIBRATION_PATTERNS: VibrationPatterns = GAME_VALUES.vibrations;

/** The longest step of a pattern, buzz or pause, in ms. */
export const LONGEST_STEP = 300;
/** The most steps a pattern holds, as many as the browser plays. */
export const MOST_STEPS = 99;

/** A stretch of time the phone buzzes, from `start` to `end`, in ms on some clock. */
export interface Buzz {
  readonly start: number;
  readonly end: number;
}

/** The buzzes of a pattern played at time `at`. */
export function buzzesOf(pattern: VibrationPattern, at: number): Buzz[] {
  let time = at;
  return pattern.flatMap((duration, i) => {
    const start = time;
    time += duration;
    return i % 2 === 0 && duration > 0 ? [{ start, end: time }] : [];
  });
}

/**
 * The one pattern that plays, from `now` on, every buzz still to come, overlapping ones merged into one: the browser plays
 * one pattern at a time, each cutting off the one before, so the vibrations of events close together, such as each slot
 * of a word landing on the tape, play as one. Timed to the millisecond, as the browser takes it; empty if no buzz is left.
 */
export function mix(buzzes: readonly Buzz[], now: number): number[] {
  const left = buzzes
    .map(({ start, end }) => ({
      start: Math.max(0, Math.round(start - now)),
      end: Math.round(end - now),
    }))
    .filter(({ start, end }) => end > start)
    .sort((a, b) => a.start - b.start);
  const merged: Buzz[] = [];
  for (const buzz of left) {
    const last = merged.at(-1);
    if (last !== undefined && buzz.start <= last.end) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, buzz.end) };
    } else {
      merged.push(buzz);
    }
  }
  // Starting with a buzz: of nothing, if the first buzz is yet to start.
  let time = 0;
  return merged.flatMap(({ start, end }, i) => {
    const pause = start - time;
    time = end;
    return i === 0 && pause === 0 ? [end - start] : [...(i === 0 ? [0] : []), pause, end - start];
  });
}

/** A pattern read from untrusted data, or `undefined` if invalid. */
export function parsePattern(value: unknown): VibrationPattern | undefined {
  return Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= MOST_STEPS &&
    value.every(
      (step) => Number.isInteger(step) && Number(step) >= 0 && Number(step) <= LONGEST_STEP,
    )
    ? (value as number[])
    : undefined;
}

/** How far along its slider a step's duration sits, from 0 to 1: squared, for finer control over the short ones. */
export function sliderOf(duration: number): number {
  return Math.sqrt(Math.min(Math.max(duration, 0), LONGEST_STEP) / LONGEST_STEP);
}

/** The duration of a step at a place along its slider, from 0 to 1 (see {@link sliderOf}), to the millisecond. */
export function durationAt(slider: number): number {
  return Math.round(LONGEST_STEP * Math.min(Math.max(slider, 0), 1) ** 2);
}
