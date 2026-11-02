import { Provider } from '@angular/core';
import { AUDIO } from '../app/feedback/speaker';

/** A note started on the fake audio context: its frequency, when, and whether its sound still reaches the speakers. */
export interface PlayedTone {
  readonly frequency: number;
  readonly start: number;
  connected: () => boolean;
}

/**
 * A stand-in for the Web Audio API, which the test browser lacks: it notes each oscillator started, the fundamental
 * of each note first, so that tests can tell which notes played, when, and whether they were silenced.
 */
export class FakeAudio {
  /** The time on the context's clock, in seconds. */
  currentTime = 0;
  state: AudioContextState = 'running';
  readonly tones: PlayedTone[] = [];
  /** How many contexts were made. */
  made = 0;

  readonly providers: Provider[] = [
    {
      provide: AUDIO,
      useValue: () => {
        this.made++;
        return this.context();
      },
    },
  ];

  /** The frequencies of the notes played, their fundamentals alone, rounded to the hertz. */
  notes(): number[] {
    const fundamentals = this.tones.filter((_, i) => i % 3 === 0);
    return fundamentals.map(({ frequency }) => Math.round(frequency));
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
      resume: () => {
        audio.state = 'running';
        return Promise.resolve();
      },
      destination: node(),
      createDynamicsCompressor: () => node(),
      createGain: () => ({ ...node(), gain: param() }),
      createOscillator: () => {
        const oscillator = { ...node(), frequency: { value: 0 } };
        return {
          ...oscillator,
          start: (when: number) => {
            audio.tones.push({
              frequency: oscillator.frequency.value,
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
