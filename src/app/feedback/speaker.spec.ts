import { TestBed } from '@angular/core/testing';
import { INDEXED_DB } from '../player-data/run-store';
import { SoundSetting } from '../player-data/sound-setting';
import { FakeAudio } from '../../testing/fake-audio';
import { envelopeCurve, Speaker } from './speaker';
import { SOURING } from './souring';
import { DeveloperMode } from '../developer-mode/developer-mode';
import { Tweaks } from '../developer-mode/tweaks';

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

  it('fades each note in and out by an envelope played from its start, however late the note reaches the audio', () => {
    audio.currentTime = 10;
    TestBed.inject(Speaker).play([
      { pitch: 69, gain: 1, length: 1.2 },
      { pitch: 60, gain: 0.5, length: 0.7, accompaniment: true, delay: 0.1 },
    ]);

    expect(audio.envelopes).toEqual([
      { start: 10, length: 1.2 },
      { start: 10.1, length: 0.7 },
    ]);
  });

  it("starts no oscillator for a silent partial, as a plain pluck's highest", () => {
    TestBed.inject(Speaker).play([
      { pitch: 60, gain: 1, length: 1 },
      { pitch: 64, gain: 1, length: 1, timbre: 0.3 },
    ]);

    expect(audio.partials()).toHaveLength(3 + 6);
  });

  it('takes each note out of the mix once it has faded out', () => {
    TestBed.inject(Speaker).play([{ pitch: 60, gain: 1, length: 1 }]);
    expect(audio.notes()[0]?.connected()).toBe(true);

    audio.endEnvelopes();

    expect(audio.notes()[0]?.connected()).toBe(false);
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
    TestBed.inject(Speaker)
      .play([{ pitch: 60, gain: 1, length: 1 }])
      .stop();

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

  it('takes the melody off as it rings, as tuned, into a rasping buzz, the chord under it holding', async () => {
    await TestBed.inject(DeveloperMode).set(true);
    const souring = { ...SOURING, bend: -40, drift: 10, speed: 0.2 };
    await TestBed.inject(Tweaks).setSouring(souring);
    audio.currentTime = 1;
    const playing = TestBed.inject(Speaker).play([
      { pitch: 60, gain: 1, length: 1 },
      { pitch: 48, gain: 1, length: 1, accompaniment: true },
    ]);
    audio.currentTime = 1.2;

    playing.sour();

    const by = 1.4;
    const [melody, chord] = audio.notes();
    expect(audio.partials()[1]?.bends).toEqual([{ to: -30, by }]);
    expect(melody?.bends).toEqual([{ to: -40, by }]);
    expect(chord?.bends).toEqual([]);
    const added = audio.tones.filter(({ type }) => type !== 'sine');
    expect(added.map(({ type, start }) => [type, start])).toEqual([
      ['square', 1.2],
      ['triangle', 1.2],
    ]);
    expect(added[0]?.bends).toEqual([{ to: -40, by }]);
  });

  it('takes a note off once the audio runs, when soured while it waited for it', async () => {
    audio.block();
    const playing = TestBed.inject(Speaker).play([{ pitch: 60, gain: 1, length: 1 }]);
    playing.sour();

    await audio.allow();

    expect(audio.notes()[0]?.bends).toEqual([{ to: SOURING.bend, by: SOURING.speed }]);
  });

  it('plays nothing once the player turned sounds off', async () => {
    await TestBed.inject(SoundSetting).set(false);

    TestBed.inject(Speaker)
      .play([{ pitch: 60, gain: 1, length: 1 }])
      .stop();

    expect(audio.tones).toEqual([]);
    expect(audio.made).toBe(0);
  });

  it('silences the notes yet to start, letting those started ring', () => {
    const playing = TestBed.inject(Speaker).play([
      { pitch: 60, gain: 1, length: 1 },
      { pitch: 64, gain: 1, length: 1, delay: 0.2 },
    ]);
    audio.currentTime = 0.1;

    playing.stop();

    expect(audio.notes().map((note) => note.connected())).toEqual([true, false]);
  });
});

describe('envelopeCurve', () => {
  const curve = envelopeCurve(0.7, 48000);

  it('lasts as long as its note', () => {
    expect(curve).toHaveLength(0.7 * 48000);
  });

  it('starts silent, rises to its full volume, then fades out to the unheard', () => {
    expect(curve[0]).toBe(0);
    expect(Math.max(...curve)).toBe(1);
    expect(curve.at(-1)).toBeCloseTo(0.001, 6);
  });

  it('never jumps, fading in over a few milliseconds', () => {
    const steps = curve.slice(1).map((value, i) => Math.abs(value - (curve[i] ?? 0)));

    expect(Math.max(...steps)).toBeLessThan(0.005);
  });
});
