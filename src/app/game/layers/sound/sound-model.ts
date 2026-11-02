import type { Digit } from '../../pi/digit';

/**
 * What a sound model is to the rest of the game. A sound model picks the notes each digit key plays at each place, from
 * the digits typed before it, and what a word plays as it lands on the tape, so that π's digits, typed one after the
 * other, sound as melodious as they can: the song of π. As it never knows the next digit, a key sounds the same whether
 * it's right or not, and the player can touch it to hear whether it sounds as they remember. How it picks the notes is
 * its own: models are plugged in and out in `sound-models.ts`, and developer mode picks one.
 */

/** A note to play: its pitch, and how it sounds with the others played with it. */
export interface Note {
  /** As a MIDI note number: 60 is middle C, and each step up is a semitone. */
  readonly pitch: number;
  /** How loud, from 0 to 1, before the volume. */
  readonly gain: number;
  /** Whether it accompanies the melody, under it, rather than being the melody: the mix sets its own volume. */
  readonly accompaniment?: true;
  /** How long after the others it starts, in seconds, to roll a chord rather than strike it. */
  readonly delay?: number;
}

/** Notes played together, at once or rolled. */
export type Chime = readonly Note[];

/**
 * Where the game is as a key is touched: all a sound model knows. It never knows π, nor which digit is right, only the
 * digits typed so far, so that the keys can sound as soon as they're touched, before the player commits to one,
 * without giving the next digit away.
 */
export interface Moment {
  /** The digits typed so far, right ones, those of the finished words then those of the word being typed. */
  readonly typed: string;
  /** The sizes of the finished words, oldest first: the word being typed starts after them. */
  readonly words: readonly number[];
  /** The slots of the word being typed: its size as the game expects it. */
  readonly slots: number;
}

/** One thing about what a key played, in words, such as the chord under it. */
export interface SoundFact {
  readonly label: string;
  readonly value: string;
}

/**
 * What a key played, in words, for developer mode to show as it's touched: what comes from π, its place and the digits
 * typed before it, the same for every player, and what comes from the player's word, its place in it.
 */
export interface SoundNotes {
  readonly pi: readonly SoundFact[];
  readonly word: readonly SoundFact[];
}

/** A sound model, as the game sees it. */
export interface SoundModel {
  /** What each digit key plays when touched at that moment. */
  keys(moment: Moment): Readonly<Record<Digit, Chime>>;
  /** What a digit key plays when touched at that moment, in words. */
  describe(moment: Moment, digit: Digit): SoundNotes;
  /** What a word plays as it lands on the tape: `words` are the sizes of the words up to it, its own last. */
  landing(words: readonly number[]): Chime;
}

/** A sound model as developer mode sees it: what it's called, and how to make it. */
export interface SoundModelKind {
  /** What it's known by in the stored tweaks: unique among the sound models. */
  readonly id: string;
  /** What it's called in developer mode. */
  readonly label: string;
  /** What it does, in a sentence. */
  readonly description: string;
  readonly create: () => SoundModel;
}
