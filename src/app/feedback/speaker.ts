import { inject, InjectionToken, Service } from '@angular/core';
import { Tweaks } from '../developer-mode/tweaks';
import type { Chime, Note } from '../game/layers/sound/sound-model';
import { SoundSetting } from '../player-data/sound-setting';
import { SoundMix } from './sound-mix';

/** Makes the audio context the game plays in, once it first plays; none where the browser has no Web Audio API. */
export const AUDIO = new InjectionToken<() => AudioContext | undefined>('AUDIO', {
  factory: () => () => (typeof AudioContext === 'function' ? new AudioContext() : undefined),
});

/** A note's partials: how many times its frequency each is, and how loud, for a soft plucked sound, like a kalimba's. */
const PARTIALS = [
  [1, 1],
  [2, 0.3],
  [3, 0.08],
] as const;
/** How long a note takes to reach its full volume, in seconds: short, as plucked. */
const ATTACK = 0.005;
/** How loud a single note at full volume is, so that a chord with its melody doesn't clip. */
const HEADROOM = 0.25;

/** The frequency of a MIDI note number, in hertz: 69 is A at 440 Hz. */
export function frequencyOf(pitch: number): number {
  return 440 * 2 ** ((pitch - 69) / 12);
}

/**
 * Plays the game's sounds, made in code with the Web Audio API rather than recorded: each note a soft pluck that fades
 * out, in the mix as tuned in developer mode, unless the player turned sounds off. The audio context is made the first
 * time a sound plays, which is always on a tap, as browsers ask.
 */
@Service()
export class Speaker {
  private readonly createContext = inject(AUDIO);
  private readonly setting = inject(SoundSetting);
  private readonly tweaks = inject(Tweaks);
  private context: AudioContext | undefined;
  private output: AudioNode | undefined;

  /**
   * Plays notes together, `delay` ms from now, each rolled by its own delay; returns a function that silences those
   * notes yet to start, such as once what they go with is cut short.
   */
  play(chime: Chime, delay = 0): () => void {
    const context = this.setting.enabled() ? this.ready() : undefined;
    if (context === undefined || this.output === undefined) {
      return () => undefined;
    }
    const output = this.output;
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

  /** The audio context, made the first time, and running. */
  private ready(): AudioContext | undefined {
    if (this.context === undefined) {
      this.context = this.createContext();
      if (this.context !== undefined) {
        const compressor = this.context.createDynamicsCompressor();
        compressor.connect(this.context.destination);
        this.output = compressor;
      }
    }
    if (this.context?.state === 'suspended') {
      void this.context.resume();
    }
    return this.context;
  }

  /** Plucks a note at `start`, on the context's clock, fading out; returns its envelope, which all its sound goes through. */
  private voice(
    context: AudioContext,
    output: AudioNode,
    note: Note,
    start: number,
    mix: SoundMix,
  ): GainNode {
    const peak = HEADROOM * mix.volume * note.gain * (note.accompaniment ? mix.chords : 1);
    const end = start + mix.length;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(peak, start + ATTACK);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    envelope.connect(output);
    for (const [multiple, level] of PARTIALS) {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = frequencyOf(note.pitch) * multiple;
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
