import { TestBed } from '@angular/core/testing';
import { INDEXED_DB } from '../player-data/run-store';
import { SoundSetting } from '../player-data/sound-setting';
import { FakeAudio } from '../../testing/fake-audio';
import { Speaker } from './speaker';

describe('Speaker', () => {
  let audio: FakeAudio;

  beforeEach(() => {
    audio = new FakeAudio();
    TestBed.configureTestingModule({
      providers: [...audio.providers, { provide: INDEXED_DB, useValue: undefined }],
    });
  });

  it('plays each note of a chime, starting from its own delay', () => {
    audio.currentTime = 10;
    TestBed.inject(Speaker).play(
      [
        { pitch: 69, gain: 1, length: 1 },
        { pitch: 60, gain: 0.5, length: 1, accompaniment: true, delay: 0.1 },
      ],
      500,
    );

    expect(audio.notes().map(({ start }) => start)).toEqual([10.5, 10.6]);
  });

  it('makes its audio context once, as it first plays', () => {
    const speaker = TestBed.inject(Speaker);
    expect(audio.made).toBe(0);

    speaker.play([{ pitch: 60, gain: 1, length: 1 }]);
    speaker.play([{ pitch: 62, gain: 1, length: 1 }]);

    expect(audio.made).toBe(1);
  });

  it('waits for the browser to let the audio run, then plays from then', async () => {
    audio.block();
    TestBed.inject(Speaker).play([{ pitch: 60, gain: 1, length: 1 }], 100);
    expect(audio.tones).toEqual([]);

    audio.currentTime = 2;
    await audio.allow();

    expect(audio.notes().map(({ start }) => start)).toEqual([2.1]);
  });

  it('plays nothing it was waiting to play once silenced', async () => {
    audio.block();
    TestBed.inject(Speaker).play([{ pitch: 60, gain: 1, length: 1 }])();

    await audio.allow();

    expect(audio.tones).toEqual([]);
  });

  it('runs its audio again once the browser or the phone suspended it', async () => {
    const speaker = TestBed.inject(Speaker);
    speaker.play([{ pitch: 60, gain: 1, length: 1 }]);
    audio.block();

    speaker.play([{ pitch: 62, gain: 1, length: 1 }]);
    await audio.allow();

    expect(audio.state).toBe('running');
    expect(audio.notes()).toHaveLength(2);
  });

  it('gets the audio ready before the first sound, unless the player turned sounds off', async () => {
    const speaker = TestBed.inject(Speaker);
    await TestBed.inject(SoundSetting).set(false);
    speaker.warmUp();
    expect(audio.made).toBe(0);

    await TestBed.inject(SoundSetting).set(true);
    speaker.warmUp();
    speaker.warmUp();

    expect(audio.made).toBe(1);
    expect(audio.tones).toEqual([]);
  });

  it('plays nothing once the player turned sounds off', async () => {
    await TestBed.inject(SoundSetting).set(false);

    TestBed.inject(Speaker).play([{ pitch: 60, gain: 1, length: 1 }])();

    expect(audio.tones).toEqual([]);
    expect(audio.made).toBe(0);
  });

  it('silences the notes yet to start, letting those started ring', () => {
    const stop = TestBed.inject(Speaker).play([
      { pitch: 60, gain: 1, length: 1 },
      { pitch: 64, gain: 1, length: 1, delay: 0.2 },
    ]);
    audio.currentTime = 0.1;

    stop();

    expect(audio.notes().map((note) => note.connected())).toEqual([true, false]);
  });
});
