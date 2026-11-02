import { inject, InjectionToken, Service } from '@angular/core';
import { Tweaks } from '../developer-mode/tweaks';
import type { Chime, Note } from '../game/layers/sound/sound-model';
import { SoundSetting } from '../player-data/sound-setting';
import { SoundMix } from './sound-mix';

/** Makes the audio context the game plays in, once it first plays; none where the browser has no Web Audio API. */
export const AUDIO = new InjectionToken<() => AudioContext | undefined>('AUDIO', {
  factory: () => () => (typeof AudioContext === 'function' ? new AudioContext() : undefined),
});

/** How many partials a note has: its frequency, and as many times it as their rank. */
export const PARTIALS = 6;
/** The partials of a plain soft pluck, like a kalimba's, by rank, from the fundamental. */
const PLUCK = [1, 0.12, 0.02, 0, 0, 0] as const;
/**
 * Where the two resonances shaping a note's timbre are, by the rank of the partials they lift, from 1, the
 * fundamental: their centers, how far they go round them, and how wide they are.
 */
const FIRST = { center: 2, reach: 1, width: 0.7 } as const;
const SECOND = { center: 4, reach: 1.5, width: 0.9 } as const;
/** How long a note takes to reach its full volume, in seconds: short, as plucked. */
const ATTACK = 0.005;
/** How loud a single note at full volume is, so that a chord with its melody doesn't clip. */
const HEADROOM = 0.15;

/**
 * How loud each partial of a note is, from its fundamental up, the loudest at 1. With a timbre, the partials of a
 * bright pluck are lifted by two resonances, as a voice's vowels are: going round the wheel of timbres moves them
 * round an ellipse over the partials, the first from the fundamental to the third partial, the second from the
 * second to the fifth, so that the note's tone color goes round, the same way on every note, and back.
 */
function partialLevels(timbre: number | undefined): number[] {
  if (timbre === undefined) {
    return [...PLUCK];
  }
  const angle = 2 * Math.PI * timbre;
  const first = FIRST.center + FIRST.reach * Math.cos(angle);
  const second = SECOND.center + SECOND.reach * Math.sin(angle);
  const lift = (rank: number, center: number, width: number): number =>
    Math.exp(-(((rank - center) / width) ** 2));
  const levels = Array.from({ length: PARTIALS }, (_, i) => {
    const rank = i + 1;
    return (
      (0.2 + 1.5 * lift(rank, first, FIRST.width) + 1.5 * lift(rank, second, SECOND.width)) / rank
    );
  });
  const loudest = Math.max(...levels);
  return levels.map((level) => level / loudest);
}

/** The frequency of a MIDI note number, in hertz: 69 is A at 440 Hz. */
function frequencyOf(pitch: number): number {
  return 440 * 2 ** ((pitch - 69) / 12);
}

/**
 * Plays the game's sounds, made in code with the Web Audio API rather than recorded, as the sound model describes them:
 * each note a pluck that fades out, in its timbre (see {@link partialLevels}), in the mix as tuned in developer mode,
 * unless the player turned sounds off.
 *
 * Browsers only let a page's audio start on a tap or a key, and the device takes a moment to start it, so the audio is
 * got ready on the player's first tap anywhere, such as on Play (see {@link warmUp}), long before the first key sounds;
 * a note played while the audio isn't running yet waits for it, rather than being lost.
 */
@Service()
export class Speaker {
  private readonly createContext = inject(AUDIO);
  private readonly setting = inject(SoundSetting);
  private readonly tweaks = inject(Tweaks);
  private context: AudioContext | undefined;
  private output: AudioNode | undefined;

  /** Gets the audio ready to play, unless the player turned sounds off: done on every tap and key, as browsers ask. */
  warmUp(): void {
    if (this.setting.enabled()) {
      void this.ready();
    }
  }

  /**
   * Plays notes together, `delay` ms from now, each rolled by its own delay, or from once the audio runs, if it isn't
   * yet; returns a function that silences those notes yet to start, such as once what they go with is cut short.
   */
  play(chime: Chime, delay = 0): () => void {
    const ready = this.setting.enabled() ? this.ready() : undefined;
    const context = this.context;
    const output = this.output;
    if (ready === undefined || context === undefined || output === undefined) {
      return () => undefined;
    }
    if (context.state === 'running') {
      return this.schedule(context, output, chime, delay);
    }
    let stop: (() => void) | undefined;
    let stopped = false;
    void ready.then(() => {
      if (!stopped) {
        stop = this.schedule(context, output, chime, delay);
      }
    });
    return () => {
      stopped = true;
      stop?.();
    };
  }

  /** Plays notes on a running context: see {@link play}. */
  private schedule(
    context: AudioContext,
    output: AudioNode,
    chime: Chime,
    delay: number,
  ): () => void {
    const start = context.currentTime + delay / 1000;
    const mix = this.tweaks.soundMix();
    const voices = chime.map((note) => ({
      start: start + (note.delay ?? 0),
      envelope: this.voice(context, output, note, start + (note.delay ?? 0), mix),
    }));
    return () => {
      for (const voice of voices) {
        if (voice.start > context.currentTime) {
          voice.envelope.disconnect();
        }
      }
    };
  }

  /**
   * Makes the audio context the first time, and has it run; resolves once it runs, or never if the browser won't let
   * it yet; undefined where there's no audio.
   */
  private ready(): Promise<void> | undefined {
    if (this.context === undefined) {
      this.context = this.createContext();
      if (this.context !== undefined) {
        const compressor = this.context.createDynamicsCompressor();
        compressor.connect(this.context.destination);
        this.output = compressor;
      }
    }
    if (this.context === undefined) {
      return undefined;
    }
    // Suspended until the browser lets it run, or interrupted by the phone, as by a call.
    return this.context.state === 'running' ? Promise.resolve() : this.context.resume();
  }

  /** Plucks a note at `start`, on the context's clock, fading out; returns its envelope, which all its sound goes through. */
  private voice(
    context: AudioContext,
    output: AudioNode,
    note: Note,
    start: number,
    mix: SoundMix,
  ): GainNode {
    const peak = HEADROOM * note.gain * (note.accompaniment ? mix.chords : 1);
    const end = start + note.length;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(peak, start + ATTACK);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    envelope.connect(output);
    for (const [i, level] of partialLevels(note.timbre).entries()) {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = frequencyOf(note.pitch) * (i + 1);
      const partial = context.createGain();
      partial.gain.value = level;
      oscillator.connect(partial);
      partial.connect(envelope);
      oscillator.start(start);
      oscillator.stop(end);
    }
    return envelope;
  }
}
