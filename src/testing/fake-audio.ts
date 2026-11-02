import { Provider } from '@angular/core';
import { AUDIO, PARTIALS } from '../app/feedback/speaker';

/** A tone started on the fake audio context: when, and whether its sound still reaches the speakers. */
export interface PlayedTone {
  readonly start: number;
  connected: () => boolean;
}

/**
 * A stand-in for the Web Audio API, which the test browser lacks: it notes each oscillator started, a note's first
 * one first, so that tests can tell how many notes played, when, and whether they were silenced, never how they sound.
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

  /** The notes played, each as its first tone. */
  notes(): PlayedTone[] {
    return this.tones.filter((_, i) => i % PARTIALS === 0);
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
        return {
          ...oscillator,
          start: (when: number) => {
            audio.tones.push({
              start: when,
              connected: oscillator.connected,
            });
          },
          stop: () => undefined,
          get frequency() {
            return oscillator.frequency;
          },
        };
      },
    } as unknown as AudioContext;
  }
}
