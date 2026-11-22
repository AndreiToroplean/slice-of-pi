import {
  Instruments,
  MILESTONE_SOUND,
  MILESTONE_SOUNDS,
  milestoneSoundById,
} from './milestone-sounds';

/** The times the notes of a sound's version start, in seconds, and how long the last one rings. */
function played(version: (play: Instruments) => void): { starts: number[]; end: number } {
  const starts: number[] = [];
  let end = 0;
  version({
    pluck: (_timbre, _pitch, at, length) => {
      starts.push(at);
      end = Math.max(end, at + length);
    },
    air: (_pitches, at, attack, hold, release) => {
      starts.push(at);
      end = Math.max(end, at + attack + hold + release);
    },
  });
  return { starts, end };
}

describe('milestone sounds', () => {
  it('start with the game’s own, the music box', () => {
    expect(MILESTONE_SOUND).toBe('musicBox');
    expect(MILESTONE_SOUNDS[0]?.id).toBe(MILESTONE_SOUND);
    expect(new Set(MILESTONE_SOUNDS.map(({ id }) => id)).size).toBe(MILESTONE_SOUNDS.length);
    expect(milestoneSoundById('climb')?.label).toBe('Climb');
    expect(milestoneSoundById('nothing')).toBeUndefined();
  });

  it('each sum their first time up every other time, shorter, from the start', () => {
    for (const sound of MILESTONE_SOUNDS) {
      const first = played(sound.first);
      const again = played(sound.again);
      expect(Math.min(...first.starts)).toBe(0);
      expect(Math.min(...again.starts)).toBe(0);
      expect(again.end).toBeLessThan(first.end);
      expect(Math.max(...again.starts)).toBeLessThan(Math.max(...first.starts));
    }
  });
});
