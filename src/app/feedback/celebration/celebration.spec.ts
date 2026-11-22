import { TestBed } from '@angular/core/testing';
import { FakeAudio } from '../../../testing/fake-audio';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { INDEXED_DB } from '../../player-data/run-store';
import { SoundSetting } from '../../player-data/sound-setting';
import { Celebration } from './celebration';
import { FIRST_MILESTONE_WAVE, MILESTONE_WAVE } from './milestone-wave';

describe('Celebration', () => {
  let audio: FakeAudio;

  beforeEach(() => {
    audio = new FakeAudio();
    TestBed.configureTestingModule({
      providers: [...audio.providers, { provide: INDEXED_DB, useValue: undefined }],
    });
  });

  it('plays the milestone sound, the first time longer, as its wave starts', () => {
    audio.currentTime = 10;
    const celebration = TestBed.inject(Celebration);
    celebration.celebrate(true, '#e3402f');
    const first = audio.tones.length;

    expect(celebration.celebrating()).toMatchObject({
      first: true,
      color: '#e3402f',
      wave: FIRST_MILESTONE_WAVE,
    });
    expect(Math.min(...audio.tones.map(({ start }) => start))).toBe(10);

    celebration.celebrate(false, '#fd7225');
    expect(celebration.celebrating()).toMatchObject({ first: false, wave: MILESTONE_WAVE });
    expect(audio.tones.length - first).toBeGreaterThan(0);
    expect(audio.tones.length - first).toBeLessThan(first);
  });

  it('plays the sound tuned in developer mode', async () => {
    await TestBed.inject(DeveloperMode).set(true);
    const tweaks = TestBed.inject(Tweaks);
    await tweaks.setMilestoneSound('climb');
    const wave = { ...MILESTONE_WAVE, peak: 1 };
    await tweaks.setMilestoneWave(wave);
    const celebration = TestBed.inject(Celebration);
    celebration.celebrate(false, '#e3402f');

    expect(celebration.celebrating()?.wave).toEqual(wave);
    // Climb's summary: two kalimba notes and a glockenspiel's, three partials each, four for the glockenspiel.
    expect(audio.tones).toHaveLength(10);
  });

  it('has its wave alone once the player turned sounds off', async () => {
    await TestBed.inject(SoundSetting).set(false);
    const celebration = TestBed.inject(Celebration);
    celebration.celebrate(true, '#e3402f');

    expect(audio.tones).toEqual([]);
    expect(celebration.celebrating()?.first).toBe(true);
  });

  it('ends once its wave is over, unless another took its place', () => {
    const celebration = TestBed.inject(Celebration);
    celebration.celebrate(true, '#e3402f');
    const first = celebration.celebrating();
    celebration.celebrate(false, '#e3402f');
    if (first !== undefined) {
      celebration.end(first);
    }
    expect(celebration.celebrating()?.first).toBe(false);

    const again = celebration.celebrating();
    if (again !== undefined) {
      celebration.end(again);
    }
    expect(celebration.celebrating()).toBeUndefined();
  });
});
