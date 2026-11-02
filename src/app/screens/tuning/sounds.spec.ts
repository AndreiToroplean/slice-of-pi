import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { Speaker } from '../../feedback/speaker';
import { SOUND_MIX } from '../../feedback/sound-mix';
import { ARIA } from '../../game/layers/sound/aria';
import { INDEXED_DB } from '../../player-data/run-store';
import { IDBFactory } from 'fake-indexeddb';
import { Digit } from '../../game/pi/digit';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { RunStore } from '../../player-data/run-store';
import { newTouchLog } from '../../player-data/touch-log';
import { typeKey } from '../../../testing/touch-logs';
import { PLAY_WITH_MERCURY } from '../../../testing/game-break-model';
import {
  LISTENED_BREAK,
  LISTENED_DIGIT,
  LISTENED_WORD,
  listenedWords,
  listening,
  Sounds,
} from './sounds';

describe('Sounds', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PLAY_WITH_MERCURY,
        provideRouter([]),
        { provide: INDEXED_DB, useValue: undefined },
      ],
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

  it("plays in the player's groups as many as fit, then in words of 5 up to the places it plays at least", () => {
    expect(listenedWords([])).toEqual(Array.from({ length: 8 }, () => LISTENED_WORD));
    expect(listenedWords([3, 4])).toEqual([3, 4, 5, 5, 5, 5, 5, 5, 5]);
    expect(listenedWords(Array.from({ length: 40 }, () => 3))).toEqual(
      Array.from({ length: 33 }, () => 3),
    );
  });

  it("plays each word's digits, then its landing", () => {
    const model = ARIA.create();
    const song = listening(model, [3, 2]);

    expect(song.map(({ at }) => at)).toEqual([
      0,
      LISTENED_DIGIT,
      2 * LISTENED_DIGIT,
      3 * LISTENED_DIGIT,
      2 * LISTENED_DIGIT + LISTENED_BREAK,
      3 * LISTENED_DIGIT + LISTENED_BREAK,
      4 * LISTENED_DIGIT + LISTENED_BREAK,
    ]);
    expect(song[0]?.chime).toEqual(model.keys({ place: 1, words: [], slots: 3 })['1']);
    expect(song[3]?.chime).toEqual(model.landing([3]));
    expect(song[4]?.chime).toEqual(model.keys({ place: 4, words: [3], slots: 2 })['5']);
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
    const song = listening(ARIA.create(), listenedWords([]));
    expect(play).toHaveBeenCalledTimes(song.length);

    button(host, 'Stop').click();
    await stable();
    expect(stop).toHaveBeenCalledTimes(song.length);
    expect(button(host, 'Play the Song of π')).toBeDefined();
  });

  it("plays the song in the player's groups, as the break model finds them", async () => {
    TestBed.overrideProvider(INDEXED_DB, { useValue: new IDBFactory() });
    const store = TestBed.inject(RunStore);
    for (let run = 0; run < 4; run++) {
      // A pause after every 3 digits.
      let at = 0;
      await store.save(
        Array.from(PI_DECIMALS.slice(0, 15)).reduce(
          (log, digit, place) => {
            at += place === 0 ? 0 : place % 3 === 0 ? 2000 + 50 * run : 200;
            return typeKey(log, digit as Digit, at);
          },
          newTouchLog(`run-${String(run)}`, run),
        ),
      );
    }
    const play = vi.spyOn(TestBed.inject(Speaker), 'play');
    const { host, stable } = await setUp();
    await store.runs();
    await stable();
    expect(host.textContent).toContain('in your groups, then words of 5');

    button(host, 'Play the Song of π').click();

    const model = ARIA.create();
    expect(play.mock.calls[3]?.[0]).toEqual(model.landing([3]));
    expect(play.mock.calls[4]?.[0]).toEqual(model.keys({ place: 4, words: [3], slots: 3 })['5']);
  });

  it('shows the sound model picked, and what it does', async () => {
    const { host } = await setUp();

    expect(host.querySelector('app-segmented')?.textContent).toContain('Aria');
    expect(host.textContent).toContain(ARIA.description);
  });
});
