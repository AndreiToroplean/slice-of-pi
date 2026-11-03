import { inject, InjectionToken, Service } from '@angular/core';
import { Tweaks } from '../developer-mode/tweaks';
import type { Chime, Note } from '../game/layers/sound/sound-model';
import { SoundSetting } from '../player-data/sound-setting';
import { SoundMix } from './sound-mix';
import { Souring } from './souring';

/**
 * How long a stretch of sound the audio works out at a time, in seconds, as a hint the browser follows as it can. Its
 * smallest, the default, crackles on phones: when the phone doesn't let the audio work out the next stretch in time,
 * the speakers get nothing to play. Tried on a phone, 10 ms still did now and then, 20 ms never, adding about 25 ms
 * between a tap and its sound, unnoticed.
 */
const LATENCY_HINT = 0.02;

/** Makes the audio context the game plays in, once it first plays; none where the browser has no Web Audio API. */
export const AUDIO = new InjectionToken<() => AudioContext | undefined>('AUDIO', {
  factory: () => () =>
    typeof AudioContext === 'function'
      ? new AudioContext({ latencyHint: LATENCY_HINT })
      : undefined,
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
/** How faint a note gets as it ends, next to its full volume: -60 dB, unheard. */
const FLOOR = 0.001;
/**
 * How long a note's partials keep going after it ends, in seconds, as its envelope may start a little after it was
 * scheduled to, ending as much later (see {@link envelopeCurve}): longer than the audio is ever late.
 */
const TAIL = 0.1;
/** How loud a single note at full volume is, so that a chord with its melody doesn't clip. */
const HEADROOM = 0.15;
/** How loud the buzz of a sour note is at its fullest, next to the note: a square wave is loud for its volume. */
const BUZZ_LEVEL = 0.35;
/** How fast a sour note's rasp flutters, in hertz: as fast as a buzzer's. */
const RASP_RATE = 45;

/** What the speaker is playing, to act on as it rings. */
export interface Playing {
  /** Silences its notes yet to start, such as once what they go with is cut short. */
  stop(): void;
  /** Takes its melody, the notes not accompanying it, off as they ring, as a wrong key's (see {@link Souring}). */
  sour(): void;
}

const NOTHING: Playing = { stop: () => undefined, sour: () => undefined };

/**
 * A note being played: its pitch, when it starts and ends, whether it's the melody, what all its sound goes through,
 * its tone before the envelope, and the pitches of its partials sounding, by their rank, lowest first.
 */
interface Voice {
  readonly pitch: number;
  readonly start: number;
  readonly end: number;
  readonly melody: boolean;
  readonly envelope: GainNode;
  readonly tone: GainNode;
  readonly partials: readonly { readonly rank: number; readonly detune: AudioParam }[];
}

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

/**
 * A note's envelope, its volume over its `length` in seconds, as samples at `sampleRate`, from 0 up to its full volume,
 * 1, over {@link ATTACK}, then fading out to the {@link FLOOR}.
 *
 * Played as samples rather than as changes scheduled on the audio's clock, it always plays from its start, however late
 * the note reaches the audio: the audio is worked out in chunks ahead of what the speakers play, so that a note played
 * at once reaches it a little after its time, by up to a chunk, and a fade-in scheduled on the clock would then be
 * over, the note starting at its full volume, with a click.
 */
export function envelopeCurve(length: number, sampleRate: number): Float32Array<ArrayBuffer> {
  const samples = Math.max(1, Math.round(length * sampleRate));
  const attack = Math.max(1, Math.min(samples, Math.round(ATTACK * sampleRate)));
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    curve[i] =
      i < attack ? i / attack : FLOOR ** ((i - attack) / Math.max(1, samples - 1 - attack));
  }
  return curve;
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
  /** The envelopes of the notes played so far, by their length in ms, made once each (see {@link envelopeCurve}). */
  private readonly envelopes = new Map<number, AudioBuffer>();

  /** Gets the audio ready to play, unless the player turned sounds off: done on every tap and key, as browsers ask. */
  warmUp(): void {
    if (this.setting.enabled()) {
      void this.ready();
    }
  }

  /**
   * Plays notes together, `delay` ms from now, each rolled by its own delay, or from once the audio runs, if it isn't
   * yet, to stop or sour as they ring.
   */
  play(chime: Chime, delay = 0): Playing {
    const ready = this.setting.enabled() ? this.ready() : undefined;
    const context = this.context;
    const output = this.output;
    if (ready === undefined || context === undefined || output === undefined) {
      return NOTHING;
    }
    if (context.state === 'running') {
      return this.schedule(context, output, chime, delay);
    }
    let playing: Playing | undefined;
    let stopped = false;
    let soured = false;
    void ready.then(() => {
      if (!stopped) {
        playing = this.schedule(context, output, chime, delay);
        if (soured) {
          playing.sour();
        }
      }
    });
    return {
      stop: () => {
        stopped = true;
        playing?.stop();
      },
      sour: () => {
        soured = true;
        playing?.sour();
      },
    };
  }

  /** Plays notes on a running context: see {@link play}. */
  private schedule(context: AudioContext, output: AudioNode, chime: Chime, delay: number): Playing {
    const start = context.currentTime + delay / 1000;
    const mix = this.tweaks.soundMix();
    const voices = chime.map((note) =>
      this.voice(context, output, note, start + (note.delay ?? 0), mix),
    );
    return {
      stop: () => {
        for (const voice of voices) {
          if (voice.start > context.currentTime) {
            voice.envelope.disconnect();
          }
        }
      },
      sour: () => {
        const from = Math.max(context.currentTime, ...voices.map((voice) => voice.start));
        const souring = this.tweaks.souring();
        for (const voice of voices) {
          if (voice.melody && voice.end > from) {
            sour(context, voice, souring, from);
          }
        }
      },
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

  /** The envelope of a note `length` seconds long: see {@link envelopeCurve}. */
  private envelope(context: AudioContext, length: number): AudioBuffer {
    const key = Math.round(length * 1000);
    let buffer = this.envelopes.get(key);
    if (buffer === undefined) {
      const curve = envelopeCurve(key / 1000, context.sampleRate);
      buffer = context.createBuffer(1, curve.length, context.sampleRate);
      buffer.copyToChannel(curve, 0);
      this.envelopes.set(key, buffer);
    }
    return buffer;
  }

  /**
   * Plucks a note at `start`, on the context's clock, fading out (see {@link envelopeCurve}), its tone through a gain a
   * sour note's rasp shakes.
   */
  private voice(
    context: AudioContext,
    output: AudioNode,
    note: Note,
    start: number,
    mix: SoundMix,
  ): Voice {
    const peak = HEADROOM * note.gain * (note.accompaniment ? mix.chords : 1);
    const end = start + note.length;
    const level = context.createGain();
    level.gain.value = peak;
    level.connect(output);
    // Its volume is the curve's alone: the gain adds what's connected to it to its own value.
    const envelope = context.createGain();
    envelope.gain.value = 0;
    envelope.connect(level);
    const curve = context.createBufferSource();
    curve.buffer = this.envelope(context, note.length);
    curve.connect(envelope.gain);
    curve.start(start);
    const tone = context.createGain();
    tone.connect(envelope);
    // Silent partials, as a plain pluck's highest, are left out: each would be an oscillator the device works out for
    // nothing.
    const partials = partialLevels(note.timbre).flatMap((level, i) => {
      if (level === 0) {
        return [];
      }
      const oscillator = context.createOscillator();
      oscillator.frequency.value = frequencyOf(note.pitch) * (i + 1);
      const partial = context.createGain();
      partial.gain.value = level;
      oscillator.connect(partial);
      partial.connect(tone);
      oscillator.start(start);
      oscillator.stop(end + TAIL);
      return [{ rank: i + 1, detune: oscillator.detune }];
    });
    return {
      pitch: note.pitch,
      start,
      end,
      melody: note.accompaniment !== true,
      envelope,
      tone,
      partials,
    };
  }
}

/**
 * Takes a note off from `from`, as it rings, over the souring's speed: its pitch sags and its harmonics drift apart, a
 * buzz at its pitch, sagging with it, fades in, and its volume starts fluttering, as a buzzer's.
 */
function sour(context: AudioContext, voice: Voice, souring: Souring, from: number): void {
  const to = from + souring.speed;
  for (const { rank, detune } of voice.partials) {
    detune.setValueAtTime(0, from);
    detune.linearRampToValueAtTime(souring.bend + (rank - 1) * souring.drift, to);
  }
  const buzz = context.createOscillator();
  buzz.type = 'square';
  buzz.frequency.value = frequencyOf(voice.pitch);
  buzz.detune.setValueAtTime(0, from);
  buzz.detune.linearRampToValueAtTime(souring.bend, to);
  const buzzLevel = context.createGain();
  buzzLevel.gain.setValueAtTime(0, from);
  buzzLevel.gain.linearRampToValueAtTime(BUZZ_LEVEL * souring.buzz, to);
  buzz.connect(buzzLevel);
  buzzLevel.connect(voice.tone);
  const rasp = context.createOscillator();
  rasp.type = 'triangle';
  rasp.frequency.value = RASP_RATE;
  const raspDepth = context.createGain();
  raspDepth.gain.setValueAtTime(0, from);
  // The tone's volume, 1, shakes by as much as half of it either way.
  raspDepth.gain.linearRampToValueAtTime(souring.rasp / 2, to);
  rasp.connect(raspDepth);
  raspDepth.connect(voice.tone.gain);
  for (const oscillator of [buzz, rasp]) {
    oscillator.start(from);
    oscillator.stop(voice.end);
  }
}
