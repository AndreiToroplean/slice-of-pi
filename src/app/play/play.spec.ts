import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import {
  FakeAnimation,
  installAnimations,
  uninstallAnimations,
} from '../../testing/fake-animations';
import { FLIGHT_DURATION } from '../flight/flight';
import { PALETTE, placeColors } from '../place-colors/place-colors';
import { TypedDigits } from '../typed-digits/typed-digits';
import { seasonAt } from '../seasons/seasons';
import { Play } from './play';

describe('Play', () => {
  // Compiles the play screen once, before its tests, so that the first one doesn't pay for it.
  beforeAll(async () => {
    const fixture = TestBed.createComponent(Play);
    await fixture.whenStable();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function setUp(): Promise<{ host: HTMLElement; type: (key: string) => Promise<void> }> {
    const fixture = TestBed.createComponent(Play);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const type = async (key: string): Promise<void> => {
      host.querySelector<HTMLButtonElement>(`button[data-key="${key}"]`)?.click();
      await fixture.whenStable();
    };
    return { host, type };
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

    expect(host.querySelector('h1')?.textContent).toBe('Slice of π');
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

  describe('colors', () => {
    function keyColor(host: HTMLElement, key: string): string | undefined {
      return host
        .querySelector<HTMLElement>(`button[data-key="${key}"]`)
        ?.style.getPropertyValue('--key-color');
    }

    function placeColorsShown(host: HTMLElement, selector: string): string[] {
      return Array.from(host.querySelectorAll<HTMLElement>(selector), (element) =>
        element.style.getPropertyValue('--place-color'),
      ).filter((color) => color !== '');
    }

    it('gives each typed digit the color its key showed, and moves the key on to its next color', async () => {
      const { host, type } = await setUp();
      expect(keyColor(host, '1')).toBe(PALETTE[1]);

      await typeAll(type, '1');
      expect(placeColorsShown(host, 'app-slots .slot')).toEqual([PALETTE[1]]);
      expect(keyColor(host, '1')).toBe(PALETTE[2]);

      await typeAll(type, '41');
      expect(placeColorsShown(host, 'app-slots .slot')).toEqual([
        PALETTE[1],
        PALETTE[4],
        PALETTE[2],
      ]);
      expect(keyColor(host, '1')).toBe(PALETTE[3]);
    });

    it('keeps the colors of the digits in their words and in the group being typed', async () => {
      const { host, type } = await setUp();

      await typeAll(type, '1415926');

      expect(placeColorsShown(host, 'app-typed-digits .word .tile')).toEqual(placeColors('14159'));
      expect(placeColorsShown(host, 'app-slots .slot')).toEqual(placeColors('1415926').slice(5));
    });

    it('gives a key its color back when its digit is deleted', async () => {
      const { host, type } = await setUp();

      await typeAll(type, '141<');

      expect(keyColor(host, '1')).toBe(PALETTE[2]);
    });
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
      expect(animations[0]?.keyframes[2]?.['transform']).toMatch(/^translate\(0px, -50px\)/);
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

    expect(host.style.getPropertyValue('--background-top')).toBe(seasonAt(0).background[0]);
    expect(host.style.getPropertyValue('--background-bottom')).toBe(seasonAt(0).background[1]);
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
    expect(host.style.getPropertyValue('--background-top')).toBe(seasonAt(25).background[0]);
    expect(TestBed.inject(Meta).getTag('name="theme-color"')?.content).toBe(
      seasonAt(25).background[0],
    );

    await type('backspace');

    expect(host.querySelector('app-season-header .name')?.textContent.trim()).toBe('Spring');
    expect(host.style.getPropertyValue('--background-top')).toBe(seasonAt(24).background[0]);
    expect(TestBed.inject(Meta).getTag('name="theme-color"')?.content).toBe(
      seasonAt(24).background[0],
    );
  });
});
