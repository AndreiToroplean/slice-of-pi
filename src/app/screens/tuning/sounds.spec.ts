import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { Speaker } from '../../feedback/speaker';
import { SOUND_MIX } from '../../feedback/sound-mix';
import { ARIA } from '../../game/layers/sound/aria';
import { INDEXED_DB } from '../../player-data/run-store';
import { LISTENED_DIGIT, LISTENED_PLACES, LISTENED_WORD, listening, Sounds } from './sounds';

describe('Sounds', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: INDEXED_DB, useValue: undefined }],
    });
  });

  async function setUp(): Promise<{ host: HTMLElement; stable: () => Promise<void> }> {
    await TestBed.inject(DeveloperMode).set(true);
    const fixture = TestBed.createComponent(Sounds);
    await fixture.whenStable();
    return { host: fixture.nativeElement as HTMLElement, stable: () => fixture.whenStable() };
  }

  function button(host: HTMLElement, label: string): HTMLButtonElement {
    const found = Array.from(host.querySelectorAll('button')).find(
      (each) => each.textContent.trim() === label,
    );
    if (found === undefined) {
      throw new Error(`No ${label}`);
    }
    return found;
  }

  it("plays π's first places in words of 5, each word landing after its last digit", () => {
    const model = ARIA.create();
    const song = listening(model);

    expect(song).toHaveLength(LISTENED_PLACES + LISTENED_PLACES / LISTENED_WORD);
    expect(song[0]).toEqual({ at: 0, chime: model.keys({ place: 1, words: [], slots: 5 })['1'] });
    expect(song[5]).toEqual({
      at: 4 * LISTENED_DIGIT + LISTENED_DIGIT,
      chime: model.landing([5]),
    });
    expect(song[6]?.chime).toEqual(model.keys({ place: 6, words: [5], slots: 5 })['2']);
  });

  it('tunes the mix, applied to the whole game while developer mode is on', async () => {
    const { host, stable } = await setUp();
    const volume = host.querySelector<HTMLInputElement>('input[type="range"]');
    expect(button(host, 'Reset All').disabled).toBe(true);

    if (volume !== null) {
      volume.value = '0.3';
      volume.dispatchEvent(new Event('input'));
    }
    await stable();

    expect(TestBed.inject(Tweaks).soundMix()).toEqual({ ...SOUND_MIX, volume: 0.3 });
    expect(host.textContent).toContain('30%');

    button(host, 'Reset All').click();
    await stable();
    expect(TestBed.inject(Tweaks).values()).toEqual({});
  });

  it('plays the song of π, and stops it', async () => {
    const stop = vi.fn();
    const play = vi.spyOn(TestBed.inject(Speaker), 'play').mockReturnValue(stop);
    const { host, stable } = await setUp();

    button(host, 'Play the Song of π').click();
    await stable();
    expect(play).toHaveBeenCalledTimes(listening(ARIA.create()).length);

    button(host, 'Stop').click();
    await stable();
    expect(stop).toHaveBeenCalledTimes(listening(ARIA.create()).length);
    expect(button(host, 'Play the Song of π')).toBeDefined();
  });

  it('shows the sound model picked, and what it does', async () => {
    const { host } = await setUp();

    expect(host.querySelector('app-segmented')?.textContent).toContain('Aria');
    expect(host.textContent).toContain(ARIA.description);
  });
});
