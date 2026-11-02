import { TestBed } from '@angular/core/testing';
import { INDEXED_DB } from '../player-data/run-store';
import { SoundSetting } from '../player-data/sound-setting';
import { FakeAudio } from '../../testing/fake-audio';
import { frequencyOf, Speaker } from './speaker';

describe('Speaker', () => {
  let audio: FakeAudio;

  beforeEach(() => {
    audio = new FakeAudio();
    TestBed.configureTestingModule({
      providers: [...audio.providers, { provide: INDEXED_DB, useValue: undefined }],
    });
  });

  it('plucks each note of a chime, a few partials each, starting from its own delay', () => {
    audio.currentTime = 10;
    TestBed.inject(Speaker).play(
      [
        { pitch: 69, gain: 1 },
        { pitch: 60, gain: 0.5, accompaniment: true, delay: 0.1 },
      ],
      500,
    );

    expect(audio.notes()).toEqual([440, 262]);
    expect(audio.tones.map(({ start }) => start)).toEqual([10.5, 10.5, 10.5, 10.6, 10.6, 10.6]);
  });

  it('makes its audio context once, as it first plays', () => {
    const speaker = TestBed.inject(Speaker);
    expect(audio.made).toBe(0);

    speaker.play([{ pitch: 60, gain: 1 }]);
    speaker.play([{ pitch: 62, gain: 1 }]);

    expect(audio.made).toBe(1);
  });

  it('resumes its audio context when the browser suspended it', () => {
    const speaker = TestBed.inject(Speaker);
    speaker.play([{ pitch: 60, gain: 1 }]);
    audio.state = 'suspended';

    speaker.play([{ pitch: 60, gain: 1 }]);

    expect(audio.state).toBe('running');
  });

  it('plays nothing once the player turned sounds off', async () => {
    await TestBed.inject(SoundSetting).set(false);

    TestBed.inject(Speaker).play([{ pitch: 60, gain: 1 }])();

    expect(audio.tones).toEqual([]);
    expect(audio.made).toBe(0);
  });

  it('silences the notes yet to start, letting those started ring', () => {
    const stop = TestBed.inject(Speaker).play([
      { pitch: 60, gain: 1 },
      { pitch: 64, gain: 1, delay: 0.2 },
    ]);
    audio.currentTime = 0.1;

    stop();

    expect(audio.tones.map((tone) => tone.connected())).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
  });

  it('tunes A to 440 Hz, each semitone a twelfth of an octave', () => {
    expect(frequencyOf(69)).toBe(440);
    expect(frequencyOf(81)).toBe(880);
    expect(frequencyOf(60)).toBeCloseTo(261.63, 2);
  });
});
