import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { Speaker } from '../../feedback/speaker';
import { SOUND_MIX } from '../../feedback/sound-mix';
import { ARIA } from '../../game/layers/sound/aria';
import { momentAt } from '../../../testing/sound-moments';
import { INDEXED_DB } from '../../player-data/run-store';
import { IDBFactory } from 'fake-indexeddb';
import { Digit } from '../../game/pi/digit';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { RunStore } from '../../player-data/run-store';
import { newTouchLog } from '../../player-data/touch-log';
import { typeKey } from '../../../testing/touch-logs';
import { PLAY_WITH_MERCURY } from '../../../testing/game-break-model';
import { FakeTime } from '../../../testing/fake-time';
import {
  LISTEN_AHEAD,
  LISTENED_BREAK,
  LISTENED_DIGIT,
  LISTENED_WORD,
  Played,
  song,
  Sounds,
} from './sounds';

describe('Sounds', () => {
  let time: FakeTime;

  beforeEach(() => {
    time = new FakeTime();
    TestBed.configureTestingModule({
      providers: [
        ...time.providers,
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

  /** The first `count` chimes of a song. */
  function first(chimes: Generator<Played, void, undefined>, count: number): Played[] {
    const taken: Played[] = [];
    for (const played of chimes) {
      if (taken.length === count) {
        break;
      }
      taken.push(played);
    }
    return taken;
  }

  it("plays each word's digits, then its landing, in the player's groups, unless words land silently", () => {
    const model = ARIA.create();
    const played = first(song(model, [3, 2], true), 7);

    expect(played.map(({ at }) => at)).toEqual([
      0,
      LISTENED_DIGIT,
      2 * LISTENED_DIGIT,
      3 * LISTENED_DIGIT,
      2 * LISTENED_DIGIT + LISTENED_BREAK,
      3 * LISTENED_DIGIT + LISTENED_BREAK,
      4 * LISTENED_DIGIT + LISTENED_BREAK,
    ]);
    expect(played[0]?.chime).toEqual(model.keys(momentAt(1, [], 3))['1']);
    expect(played[3]?.chime).toEqual(model.landing('141', [3]));
    expect(played[4]?.chime).toEqual(model.keys(momentAt(4, [3], 2))['5']);
    expect(first(song(model, [3, 2], false), 5).map(({ chime }) => chime)).toEqual(
      played.filter((_, index) => index !== 3 && index !== 6).map(({ chime }) => chime),
    );
  });

  it('plays on past the groups in words of 5, as far into π as asked', () => {
    const model = ARIA.create();
    const played = first(song(model, [3], false), 300);

    expect(played).toHaveLength(300);
    expect(played[3]?.chime).toEqual(model.keys(momentAt(4, [3], LISTENED_WORD))['5']);
    expect(played[299]?.chime).toEqual(
      model.keys(
        momentAt(300, [3, ...Array.from({ length: 59 }, () => LISTENED_WORD)], LISTENED_WORD),
      )[PI_DECIMALS.charAt(299) as Digit],
    );
  });

  it('tunes the mix, applied to the whole game while developer mode is on', async () => {
    const { host, stable } = await setUp();
    const chords = host.querySelector<HTMLInputElement>('input[type="range"]');
    expect(button(host, 'Reset All').disabled).toBe(true);

    if (chords !== null) {
      chords.value = '0.3';
      chords.dispatchEvent(new Event('input'));
    }
    await stable();

    expect(TestBed.inject(Tweaks).soundMix()).toEqual({ ...SOUND_MIX, chords: 0.3 });
    expect(host.textContent).toContain('30%');

    button(host, 'Reset All').click();
    await stable();
    expect(TestBed.inject(Tweaks).values()).toEqual({});
  });

  it('plays the song of π a little ahead at a time, until stopped', async () => {
    const stops: ReturnType<typeof vi.fn>[] = [];
    const play = vi.spyOn(TestBed.inject(Speaker), 'play').mockImplementation(() => {
      const stop = vi.fn();
      stops.push(stop);
      return stop;
    });
    const { host, stable } = await setUp();
    // Far more than the 10 s played.
    const whole = first(song(ARIA.create(), [], true), 100);
    const ahead = (time: number): number =>
      whole.filter(({ at }) => at < time + LISTEN_AHEAD).length;

    button(host, 'Play π').click();
    await stable();
    expect(play).toHaveBeenCalledTimes(ahead(0));
    expect(play.mock.calls[1]?.[1]).toBe(LISTENED_DIGIT);

    time.advance(10_000);
    expect(play).toHaveBeenCalledTimes(ahead(10_000));
    await stable();
    const shown = Array.from(host.querySelectorAll('app-sound-log p'), (line) => line.textContent);
    const played = whole.filter(({ at }) => at <= 10_000);
    expect(shown).toEqual([...played.map(({ line }) => line).reverse(), 'π in words of 5']);

    button(host, 'Stop').click();
    await stable();
    expect(stops.at(-1)).toHaveBeenCalled();
    time.advance(10_000);
    expect(play).toHaveBeenCalledTimes(ahead(10_000));
    expect(button(host, 'Play π')).toBeDefined();
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
    button(host, 'Play π').click();
    await stable();

    expect(host.querySelector('app-sound-log')?.textContent).toContain(
      'π in your 4 groups, then words of 5',
    );
    const model = ARIA.create();
    expect(play.mock.calls[3]?.[0]).toEqual(model.landing('141', [3]));
    expect(play.mock.calls[4]?.[0]).toEqual(model.keys(momentAt(4, [3], 3))['5']);
  });

  it('lands words with a chord unless told not to', async () => {
    const { host, stable } = await setUp();
    const landings = Array.from(
      host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ).find((input) => input.closest('label')?.textContent.includes('Landing Chords'));
    expect(landings?.checked).toBe(true);

    landings?.click();
    await stable();

    expect(TestBed.inject(Tweaks).landings()).toBe(false);
    expect(button(host, 'Reset All').disabled).toBe(false);
  });

  it('shows the sound model picked, and what it does', { tags: ['disabled'] }, async () => {
    const { host } = await setUp();

    expect(host.querySelector('app-segmented')?.textContent).toContain('Aria');
    expect(host.querySelector('dialog')?.textContent).toContain(ARIA.about[0]);
  });
});
