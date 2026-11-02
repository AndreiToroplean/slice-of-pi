import type { Digit } from '../../pi/digit';
import type { Season } from '../seasons';

/**
 * What a sound model is to the rest of the game. A sound model picks what each digit key plays as it's typed, from the
 * digit, its key's color index, the season, the digits typed before, the place they lead to, and the word being typed, its slots
 * and the digit's place in it, and what a word plays as it lands on the tape, so that π's digits, typed one after the
 * other, sound as melodious as they can: the song of π. It says what to play as notes, a description the speaker plays
 * (see `Speaker`), never as sound itself. How it picks the notes is its own: models are plugged in and out in `sound-models.ts`, and developer mode picks one.
 */

/** A note to play, as a description the speaker plays. */
export interface Note {
  /** As a MIDI note number: 60 is middle C, and each step up is a semitone. */
  readonly pitch: number;
  /** How loud, from 0 to 1. */
  readonly gain: number;
  /**
   * Its tone color, as a place on a wheel of timbres, in turns from 0 to 1: going round lifts other harmonics of the
   * note, as a voice's vowels do, the next place on always a little different, and 1 is 0 again. A plain soft pluck if
   * not said.
   */
  readonly timbre?: number;
  /** How long it rings, in seconds, fading out. */
  readonly length: number;
  /** Whether it accompanies the melody, under it, rather than being the melody: the mix sets its own volume. */
  readonly accompaniment?: true;
  /** How long after the others it starts, in seconds, to roll a chord rather than strike it. */
  readonly delay?: number;
}

/** Notes played together, at once or rolled. */
export type Chime = readonly Note[];

/**
 * Where the game is as a key is typed: all a sound model knows. It never knows π, nor which digit is right, only the
 * digits typed so far, so that a key sounds the same whether it's right or not, and gives nothing away.
 */
export interface Moment {
  /** The digits typed so far, right ones: those of the finished words, then those of the word being typed. */
  readonly typed: string;
  /** The sizes of the finished words, oldest first: the word being typed starts after them. */
  readonly words: readonly number[];
  /** The slots of the word being typed: its size as the game expects it. */
  readonly slots: number;
  /**
   * Each key's color index, where its color is in the palette, from 0 to 9: one more each time its digit is typed, from
   * 9 back to 0.
   */
  readonly colors: Readonly<Record<Digit, number>>;
  /** The season the screen shows. */
  readonly season: Season;
}

/** A sound model, as the game sees it. */
export interface SoundModel {
  /** What each digit key plays when typed at that moment. */
  keys(moment: Moment): Readonly<Record<Digit, Chime>>;
  /** What a word plays as it lands on the tape: `words` are the sizes of the words up to it, its own last. */
  landing(typed: string, words: readonly number[]): Chime;
}

/** A sound model as developer mode sees it: what it's called, how it works, and how to make it. */
export interface SoundModelKind {
  /** What it's known by in the stored tweaks: unique among the sound models. */
  readonly id: string;
  /** What it's called in developer mode. */
  readonly label: string;
  /** How it picks what to play, a paragraph each, for developer mode to show when asked. */
  readonly about: readonly string[];
  readonly create: () => SoundModel;
}
