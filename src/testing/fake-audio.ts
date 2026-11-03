import { Provider } from '@angular/core';
import { AUDIO, PARTIALS } from '../app/feedback/speaker';

/**
 * A tone started on the fake audio context: when, whether its sound still reaches the speakers, and where its pitch is
 * bent to, in cents, and by when, if it is.
 */
export interface PlayedTone {
  /** Its wave: a note's own partials are sine waves. */
  readonly type: OscillatorType;
  readonly start: number;
  connected: () => boolean;
  readonly bends: { readonly to: number; readonly by: number }[];
}

/**
 * A stand-in for the Web Audio API, which the test browser lacks: it notes each oscillator started, a note's first
 * one first, so that tests can tell how many notes played, when, whether they were silenced, and how far they went off
 * if wrong, never how they sound.
 */
export class FakeAudio {
  /** The time on the context's clock, in seconds. */
  currentTime = 0;
  state: AudioContextState = 'running';
  readonly tones: PlayedTone[] = [];
  /** How many contexts were made. */
  made = 0;
  /** Resolves once the browser lets the audio run: at once, unless {@link block}ed. */
  private allowed = Promise.resolve();
  private allowing: (() => void) | undefined;

  readonly providers: Provider[] = [
    {
      provide: AUDIO,
      useValue: () => {
        this.made++;
        return this.context();
      },
    },
  ];

  /** Keeps the audio from running, as browsers do before the player first taps, until {@link allow}ed. */
  block(): void {
    this.state = 'suspended';
    this.allowed = new Promise((resolve) => {
      this.allowing = resolve;
    });
  }

  /** Lets the audio run, as on the player's first tap; resolves once what waited for it has played. */
  async allow(): Promise<void> {
    this.allowing?.();
    await this.allowed;
    await Promise.resolve();
  }

  /** The notes played, each as its first partial. */
  notes(): PlayedTone[] {
    return this.partials().filter((_, i) => i % PARTIALS === 0);
  }

  /** The notes' own partials, in order, leaving out what's added to sour them. */
  partials(): PlayedTone[] {
    return this.tones.filter(({ type }) => type === 'sine');
  }

  private context(): AudioContext {
    const node = (): {
      connect: (to: { connected?: () => boolean }) => unknown;
      disconnect: () => void;
      connected: () => boolean;
    } => {
      let target: { connected?: () => boolean } | undefined;
      let cut = false;
      return {
        connect: (to) => {
          target = to;
          return to;
        },
        disconnect: () => {
          cut = true;
        },
        connected: () => !cut && (target?.connected?.() ?? true),
      };
    };
    const param = (): object => ({
      value: 0,
      setValueAtTime: () => undefined,
      linearRampToValueAtTime: () => undefined,
      exponentialRampToValueAtTime: () => undefined,
    });
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const audio = this;
    return {
      get currentTime() {
        return audio.currentTime;
      },
      get state() {
        return audio.state;
      },
      resume: () =>
        audio.allowed.then(() => {
          audio.state = 'running';
        }),
      destination: node(),
      createDynamicsCompressor: () => node(),
      createGain: () => ({ ...node(), gain: param() }),
      createOscillator: () => {
        const oscillator = { ...node(), frequency: { value: 0 } };
        const bends: { to: number; by: number }[] = [];
        const made = {
          ...oscillator,
          type: 'sine' as OscillatorType,
          detune: {
            ...param(),
            linearRampToValueAtTime: (to: number, by: number) => {
              bends.push({ to, by });
            },
          },
          start: (when: number) => {
            audio.tones.push({
              type: made.type,
              start: when,
              connected: oscillator.connected,
              bends,
            });
          },
          stop: () => undefined,
          get frequency() {
            return oscillator.frequency;
          },
        };
        return made;
      },
    } as unknown as AudioContext;
  }
}
