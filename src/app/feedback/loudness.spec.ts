import { CHORALE, CHORALE_PITCHES } from '../game/layers/sound/chorale';
import { Digit } from '../game/pi/digit';
import { PI_DECIMALS } from '../game/pi/pi-decimals';
import { heardLevel, integratedLoudness, Listening, Song } from '../../testing/loudness';
import { momentAt } from '../../testing/sound-moments';
import { SOUND_MIX } from './sound-mix';

/** π's first `count` digits as the game's sound model plays them, a key every `step` seconds, in words of 4. */
function typed(count: number, step: number): Song {
  const model = CHORALE.create();
  return Array.from({ length: count }, (_, i) => {
    const words = Array<number>(Math.floor(i / 4)).fill(4);
    const digit = PI_DECIMALS[i] as Digit;
    return { time: i * step, chime: model.keys(momentAt(i + 1, words, 4))[digit] };
  });
}

/** How far apart the loudest and the softest of the melody's notes are heard, in decibels. */
function melodySpread(listening: Listening): number {
  const levels = CHORALE_PITCHES.map((pitch) =>
    heardLevel({ pitch, gain: 1, length: 1 }, SOUND_MIX, listening),
  );
  return Math.max(...levels) - Math.min(...levels);
}

describe('Loudness', () => {
  it('plays π, typed at a usual pace, as loud as games on phones are advised to be', () => {
    // A key every 300 ms, as the break models' synthetic runs have it.
    const loudness = integratedLoudness(typed(60, 0.3), SOUND_MIX);

    expect(loudness).toBeGreaterThan(-20);
    expect(loudness).toBeLessThan(-16);
  });

  it("plays the melody's notes about as loud as each other, on a phone's speakers and in headphones", () => {
    expect(melodySpread('headphones')).toBeLessThan(2);
    expect(melodySpread('phone')).toBeLessThan(5);
  });
});
