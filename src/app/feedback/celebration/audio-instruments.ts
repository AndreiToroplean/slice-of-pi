import { Instruments, Timbre, TIMBRES } from './milestone-sounds';

/** How loud the reverb is, next to the notes themselves. */
const REVERB = 0.3;
/** How long the reverb rings, in seconds. */
const REVERB_LENGTH = 2.6;
/** How faint a note gets as it ends: -80 dB, unheard. */
const FLOOR = 0.0001;
/** How long a struck note takes to reach its full volume, in seconds: at once, without a click. */
const STRIKE = 0.004;

/** The reverb of each audio context, made once. */
const reverbs = new WeakMap<BaseAudioContext, AudioNode>();

/**
 * A reverb into `output`: white noise fading out, as a room answers, convolved with what goes into it. Made once for
 * each context, as its noise takes a moment to make.
 */
function reverbOf(context: BaseAudioContext, output: AudioNode): AudioNode {
  let reverb = reverbs.get(context);
  if (reverb === undefined) {
    const length = Math.round(context.sampleRate * REVERB_LENGTH);
    const response = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const samples = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        samples[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
      }
      response.copyToChannel(samples, channel);
    }
    const convolver = context.createConvolver();
    convolver.buffer = response;
    const wet = context.createGain();
    wet.gain.value = REVERB;
    convolver.connect(wet);
    wet.connect(output);
    reverb = convolver;
    reverbs.set(context, reverb);
  }
  return reverb;
}

/** The frequency of a MIDI note number, in hertz: 69 is A at 440 Hz. */
function frequencyOf(pitch: number): number {
  return 440 * 2 ** ((pitch - 69) / 12);
}

/**
 * The instruments a milestone sound plays on, with the Web Audio API, into `output`, from `start` on the context's
 * clock, each note also sent through a reverb.
 */
export function audioInstruments(
  context: BaseAudioContext,
  output: AudioNode,
  start: number,
): Instruments {
  const reverb = reverbOf(context, output);
  /** A gain into the output, its sound also sent to the reverb, as much as `send`. */
  const channel = (gain: number, send: number): GainNode => {
    const level = context.createGain();
    level.gain.value = gain;
    level.connect(output);
    const sent = context.createGain();
    sent.gain.value = send;
    level.connect(sent);
    sent.connect(reverb);
    return level;
  };
  const oscillator = (
    to: AudioNode,
    hertz: number,
    from: number,
    until: number,
    type: OscillatorType = 'sine',
  ): void => {
    const made = context.createOscillator();
    made.type = type;
    made.frequency.value = hertz;
    made.connect(to);
    made.start(from);
    made.stop(until);
  };
  return {
    pluck(timbre: Timbre, pitch: number, at: number, length: number, gain: number): void {
      const from = start + at;
      const level = channel(gain, 0.45);
      for (const [ratio, partialLevel, ring] of TIMBRES[timbre]) {
        const envelope = context.createGain();
        envelope.gain.setValueAtTime(0, from);
        envelope.gain.linearRampToValueAtTime(partialLevel, from + STRIKE);
        envelope.gain.exponentialRampToValueAtTime(FLOOR, from + Math.max(0.05, length * ring));
        envelope.connect(level);
        oscillator(envelope, frequencyOf(pitch) * ratio, from, from + length + 0.1);
      }
    },
    air(
      pitches: readonly number[],
      at: number,
      attack: number,
      hold: number,
      release: number,
      gain: number,
    ): void {
      const from = start + at;
      const end = from + attack + hold + release;
      const level = channel(gain, 0.9);
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0, from);
      envelope.gain.linearRampToValueAtTime(1, from + attack);
      envelope.gain.setValueAtTime(1, from + attack + hold);
      envelope.gain.exponentialRampToValueAtTime(FLOOR, end);
      envelope.connect(level);
      // A sine and a triangle wave a little apart, for the chord to breathe.
      for (const pitch of pitches) {
        for (const [type, cents, share] of [
          ['sine', -5, 0.6],
          ['triangle', 5, 0.4],
        ] as const) {
          const part = context.createGain();
          part.gain.value = share;
          part.connect(envelope);
          oscillator(part, frequencyOf(pitch) * 2 ** (cents / 1200), from, end + 0.05, type);
        }
      }
    },
  };
}
