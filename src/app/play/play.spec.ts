import { Location } from '@angular/common';
import { provideLocationMocks, SpyLocation } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  FakeAnimation,
  installAnimations,
  uninstallAnimations,
} from '../../testing/fake-animations';
import { installDialogs, uninstallDialogs } from '../../testing/fake-dialogs';
import { Background } from '../background/background';
import { FLIGHT_DURATION } from '../flight/flight';
import { routes } from '../app.routes';
import { Menu } from '../menu/menu';
import { TypedDigits } from '../typed-digits/typed-digits';
import { seasonAt } from '../seasons/seasons';
import { Play } from './play';

describe('Play', () => {
  // Compiles the play screen once, before its tests, so that the first one doesn't pay for it.
  beforeAll(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const fixture = TestBed.createComponent(Play);
    await fixture.whenStable();
    TestBed.resetTestingModule();
  });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideLocationMocks()] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function setUp(): Promise<{
    host: HTMLElement;
    type: (key: string) => Promise<void>;
    stable: () => Promise<void>;
  }> {
    const fixture = TestBed.createComponent(Play);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const type = async (key: string): Promise<void> => {
      host.querySelector<HTMLButtonElement>(`button[data-key="${key}"]`)?.click();
      await fixture.whenStable();
    };
    return { host, type, stable: () => fixture.whenStable() };
  }

  async function typeAll(type: (key: string) => Promise<void>, keys: string): Promise<void> {
    for (const key of keys) {
      await type(key === '<' ? 'backspace' : key);
    }
  }

  function words(host: HTMLElement): string[] {
    return Array.from(host.querySelectorAll('app-typed-digits .word'), (word) =>
      word.textContent.replace(/\s/g, ''),
    );
  }

  function slots(host: HTMLElement): string[] {
    return Array.from(host.querySelectorAll('app-slots .slot'), (slot) => slot.textContent);
  }

  function summary(host: HTMLElement): string | undefined {
    return host.querySelector('app-typed-digits .visually-hidden')?.textContent;
  }

  it('has a heading', async () => {
    const { host } = await setUp();

    expect(host.querySelector('h1')?.textContent).toBe('Slice of Pi');
  });

  it('starts with the "3." lead, no words and 5 empty slots', async () => {
    const { host } = await setUp();

    expect(host.querySelector('app-typed-digits .lead')?.textContent.replace(/\s/g, '')).toBe('3.');
    expect(words(host)).toEqual([]);
    expect(slots(host)).toEqual(['', '', '', '', '']);
    expect(summary(host)).toBe('No digits typed yet.');
  });

  it('fills the slots with the digits typed', async () => {
    const { host, type } = await setUp();

    await typeAll(type, '141');

    expect(slots(host)).toEqual(['1', '4', '1', '', '']);
    expect(words(host)).toEqual([]);
    expect(summary(host)).toBe('3 digits typed, the last one is 1.');
  });

  it('turns every 5 digits into a word and empties the slots', async () => {
    const { host, type } = await setUp();

    await typeAll(type, '14159');

    expect(words(host)).toEqual(['14159']);
    expect(slots(host)).toEqual(['', '', '', '', '']);

    await typeAll(type, '265358');

    expect(words(host)).toEqual(['14159', '26535']);
    expect(slots(host)).toEqual(['8', '', '', '', '']);
    expect(summary(host)).toBe('11 digits typed, the last one is 8.');
  });

  it('deletes the last digit with backspace', async () => {
    const { host, type } = await setUp();

    await typeAll(type, '314<<5');

    expect(slots(host)).toEqual(['3', '5', '', '', '']);
    expect(summary(host)).toBe('2 digits typed, the last one is 5.');
  });

  it('reopens the last word with backspace when the slots are empty', async () => {
    const { host, type } = await setUp();

    await typeAll(type, '1415926535<');

    expect(words(host)).toEqual(['14159']);
    expect(slots(host)).toEqual(['2', '6', '5', '3', '']);

    await typeAll(type, '<<<<<');

    expect(words(host)).toEqual([]);
    expect(slots(host)).toEqual(['1', '4', '1', '5', '']);
  });

  it('does nothing on backspace when nothing is typed', async () => {
    const { host, type } = await setUp();

    await type('backspace');

    expect(slots(host)).toEqual(['', '', '', '', '']);
    expect(summary(host)).toBe('No digits typed yet.');
  });

  describe('when a group is finished', () => {
    function stubAnimations(): FakeAnimation[] {
      vi.stubGlobal('matchMedia', () => ({ matches: false }));
      return installAnimations();
    }

    afterEach(() => {
      uninstallAnimations();
    });

    function shownTiles(host: HTMLElement): string {
      return Array.from(
        host.querySelectorAll<HTMLElement>('app-typed-digits .word .tile'),
        (tile) => (tile.style.visibility === 'hidden' ? '_' : tile.textContent.trim()),
      ).join('');
    }

    function flyingSlots(host: HTMLElement): string {
      return Array.from(host.querySelectorAll('.flying-slot'), (slot) => slot.textContent).join('');
    }

    it('flies each slot into its tile, which shows as its slot lands, so no digit ever goes missing', async () => {
      const animations = stubAnimations();
      const { host, type } = await setUp();

      await typeAll(type, '14159');

      expect(animations).toHaveLength(5);
      expect(flyingSlots(host)).toBe('14159');
      expect(shownTiles(host)).toBe('_____');

      for (const [i, animation] of animations.entries()) {
        animation.finish();
        expect(shownTiles(host)).toBe('14159'.slice(0, i + 1).padEnd(5, '_'));
        expect(flyingSlots(host)).toBe('14159'.slice(i + 1));
      }
    });

    it('starts every flight shaped like its slot, even while it waits for its turn to leave', async () => {
      const animations = stubAnimations();
      const { host, type } = await setUp();

      await typeAll(type, '14159');

      expect(animations.every((animation) => animation.options?.fill === 'both')).toBe(true);
      const radius = getComputedStyle(
        host.querySelector('app-slots .slot') ?? host,
      ).borderTopLeftRadius;
      for (const slot of host.querySelectorAll<HTMLElement>('.flying-slot')) {
        expect(slot.style.borderRadius).toBe(`${String(parseFloat(radius) || 0)}px`);
      }
    });

    it('aims for where the word will be once the typed digits have scrolled down to it', async () => {
      const animations = stubAnimations();
      const scrollDown = vi.spyOn(TypedDigits.prototype, 'scrollDown').mockReturnValue(50);
      const { type } = await setUp();

      await typeAll(type, '14159');

      expect(scrollDown).toHaveBeenCalledWith(FLIGHT_DURATION);
      expect(animations[0]?.keyframes[1]?.['transform']).toMatch(/^translate\(0px, -50px\)/);
    });

    it('lands the flights at once on backspace', async () => {
      const animations = stubAnimations();
      const { host, type } = await setUp();

      await typeAll(type, '14159<');

      expect(animations.every((animation) => animation.playState === 'idle')).toBe(true);
      expect(flyingSlots(host)).toBe('');
      expect(slots(host)).toEqual(['1', '4', '1', '5', '']);
    });

    it("doesn't fly when the player prefers reduced motion", async () => {
      const animations = stubAnimations();
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      const { host, type } = await setUp();

      await typeAll(type, '14159');

      expect(animations).toEqual([]);
      expect(shownTiles(host)).toBe('14159');
    });
  });

  it('starts with the spring background and header', async () => {
    const { host } = await setUp();

    expect(TestBed.inject(Background).colors()).toEqual(seasonAt(0).background);
    expect(host.querySelector('app-season-header .place')?.textContent.trim()).toBe(
      'Year 1 · digit 0 of 100',
    );
  });

  it('moves through the seasons as digits are typed, and back with backspace', async () => {
    const { host, type } = await setUp();

    for (let i = 0; i < 25; i++) {
      await type('1');
    }

    expect(host.querySelector('app-season-header .name')?.textContent.trim()).toBe('Summer');
    expect(TestBed.inject(Background).colors()).toEqual(seasonAt(25).background);

    await type('backspace');

    expect(host.querySelector('app-season-header .name')?.textContent.trim()).toBe('Spring');
    expect(TestBed.inject(Background).colors()).toEqual(seasonAt(24).background);
  });

  describe('paused', () => {
    beforeEach(() => {
      installDialogs();
    });

    afterEach(() => {
      uninstallDialogs();
    });

    function pauseItem(host: HTMLElement, label: string): HTMLButtonElement {
      const item = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent.trim() === label || button.ariaLabel === label,
      );
      if (item === undefined) {
        throw new Error(`No button ${label}`);
      }
      return item;
    }

    it("ignores keys typed on a keyboard until it's resumed", async () => {
      const { host, type, stable } = await setUp();
      await type('1');

      pauseItem(host, 'Pause').click();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }));
      await stable();
      expect(slots(host)).toEqual(['1', '', '', '', '']);

      pauseItem(host, 'Resume').click();
      await type('4');
      expect(slots(host)).toEqual(['1', '4', '', '', '']);
    });

    it('restarts the game: no digits, back to the first spring', async () => {
      const { host, type, stable } = await setUp();
      await typeAll(type, '1415926535897932384626433');

      pauseItem(host, 'Pause').click();
      pauseItem(host, 'Restart').click();
      await stable();

      expect(words(host)).toEqual([]);
      expect(slots(host)).toEqual(['', '', '', '', '']);
      expect(host.querySelector('app-season-header .name')?.textContent.trim()).toBe('Spring');
      expect(TestBed.inject(Background).colors()).toEqual(seasonAt(0).background);
      expect(host.querySelector('dialog')?.open).toBe(false);

      await type('1');
      expect(slots(host)).toEqual(['1', '', '', '', '']);
    });

    it('restarts during a flight, landing it at once', async () => {
      const animations = installAnimations();
      vi.stubGlobal('matchMedia', () => ({ matches: false }));
      try {
        const { host, type, stable } = await setUp();
        await typeAll(type, '14159');
        expect(animations.length).toBeGreaterThan(0);

        pauseItem(host, 'Pause').click();
        pauseItem(host, 'Restart').click();
        await stable();

        expect(animations.every((animation) => animation.playState === 'idle')).toBe(true);
        expect(words(host)).toEqual([]);
      } finally {
        uninstallAnimations();
      }
    });

    /** Ends the game, letting it navigate once the dialog has closed. */
    async function endGame(harness: RouterTestingHarness): Promise<void> {
      const host = harness.routeNativeElement;
      if (host === null) {
        throw new Error('No play screen');
      }
      pauseItem(host, 'Pause').click();
      pauseItem(host, 'End game').click();
      await new Promise((resolve) => setTimeout(resolve));
    }

    it('ends a game started from the main menu by going back to it, so back then leaves', async () => {
      const harness = await RouterTestingHarness.create('/');
      // Listens to the history, as the app does once started.
      TestBed.inject(Router).initialNavigation();
      await harness.navigateByUrl('/play');
      const location = TestBed.inject(Location) as SpyLocation;
      const back = vi.spyOn(location, 'back');

      await endGame(harness);
      // The router follows the history going back on its next turn.
      await new Promise((resolve) => setTimeout(resolve));
      await harness.fixture.whenStable();

      expect(back).toHaveBeenCalledOnce();
      expect(TestBed.inject(Router).url).toBe('/');
      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(Menu);
    });

    it('ends a game opened directly by putting the main menu in its place', async () => {
      const harness = await RouterTestingHarness.create('/play');
      const location = TestBed.inject(Location) as SpyLocation;
      const back = vi.spyOn(location, 'back');

      await endGame(harness);
      await harness.fixture.whenStable();

      expect(back).not.toHaveBeenCalled();
      expect(TestBed.inject(Router).url).toBe('/');
      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(Menu);
      expect(location.urlChanges.at(-1)).toBe('replace: /');
    });
  });
});
