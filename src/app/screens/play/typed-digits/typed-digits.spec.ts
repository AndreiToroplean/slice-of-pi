import { ComponentFixture, TestBed } from '@angular/core/testing';
import { groupDigits, Word } from '../../../game/grouping/groups';
import { PALETTE, placeColors } from '../../../game/layers/place-colors';
import { FIRST_LANDING } from '../flight/flight';
import { PI_DECIMALS } from '../../../game/pi/pi-decimals';
import { SCROLL_BACK_DURATION, TypedDigits } from './typed-digits';

/** The words of the digits typed in groups of 5. */
function wordsOf5(digits: string): readonly Word[] {
  return groupDigits(
    digits,
    Array.from({ length: Math.floor(digits.length / 5) }, () => 5),
  ).words;
}

describe('TypedDigits', () => {
  async function render(digits: string): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(TypedDigits);
    fixture.componentRef.setInput('words', wordsOf5(digits));
    fixture.componentRef.setInput('digits', digits);
    fixture.componentRef.setInput('colors', placeColors(digits));
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function words(host: HTMLElement): string[] {
    return Array.from(host.querySelectorAll('.word'), (word) =>
      Array.from(word.querySelectorAll('.tile'), (tile) => tile.textContent).join(''),
    );
  }

  it('starts with "π=3." as a word of four tiles, every other one shaded, and no other words', async () => {
    const host = await render('');

    expect(
      Array.from(host.querySelectorAll('.lead .tile'), (tile) => tile.textContent.trim()),
    ).toEqual(['π', '=', '3', '.']);
    expect(
      Array.from(host.querySelectorAll('.lead .tile'), (tile) => tile.classList.contains('shade')),
    ).toEqual([false, true, false, true]);
    expect(words(host)).toEqual([]);
  });

  it('shows each finished group as a word of tiles, in order, after the lead', async () => {
    const host = await render('141592653589');

    expect(words(host)).toEqual(['14159', '26535']);
    expect(host.querySelector('.words')?.firstElementChild?.classList).toContain('lead');
  });

  it('shows each tile in its place color, and the lead in none', async () => {
    const host = await render('1415926535');

    expect(
      Array.from(host.querySelectorAll<HTMLElement>('.word .tile'), (tile) =>
        tile.style.getPropertyValue('--place-color'),
      ),
    ).toEqual(placeColors('1415926535'));
    expect(placeColors('1415926535')[2]).toBe(PALETTE[2]);
    expect(
      Array.from(host.querySelectorAll<HTMLElement>('.lead .tile'), (tile) =>
        tile.style.getPropertyValue('--place-color'),
      ),
    ).toEqual(['', '', '', '']);
  });

  it('marks each word with the place of its first digit', async () => {
    const host = await render('1415926535');

    expect(
      Array.from(host.querySelectorAll<HTMLElement>('.word'), (word) => word.dataset['firstPlace']),
    ).toEqual(['1', '6']);
  });

  it('is a focusable region, so it can be scrolled with the keyboard', async () => {
    const host = await render('');

    expect(host.getAttribute('role')).toBe('region');
    expect(host.getAttribute('aria-label')).toBe('Typed digits');
    expect(host.tabIndex).toBe(0);
  });

  it('says what was typed to assistive technology, rather than showing it digit by digit', async () => {
    expect((await render('')).querySelector('.visually-hidden')?.textContent).toBe(
      'No digits typed yet.',
    );
    expect((await render('1415926')).querySelector('.visually-hidden')?.textContent).toBe(
      '7 digits typed, the last one is 6.',
    );
    expect((await render('')).querySelector('.words')?.getAttribute('aria-hidden')).toBe('true');
  });

  describe('scrolling', () => {
    /** How wide the tape shows, a tile, and the space between words, in pixels. */
    const VIEW = 200;
    const TILE = 10;
    const GAP = 5;
    let time: number;
    let frames: FrameRequestCallback[];

    beforeEach(() => {
      time = 0;
      frames = [];
      vi.spyOn(performance, 'now').mockImplementation(() => time);
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
        frames.push(callback),
      );
      vi.stubGlobal('cancelAnimationFrame', () => undefined);
      // The lead and each word end after their tiles, words GAP apart, from the start of the words.
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement,
      ) {
        const siblings = Array.from(this.parentElement?.children ?? []);
        const upTo = siblings.slice(0, siblings.indexOf(this) + 1);
        const right = upTo.reduce(
          (end, element) => end + element.querySelectorAll('.tile').length * TILE,
          (upTo.length - 1) * GAP,
        );
        return { left: 0, right } as DOMRect;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    /**
     * A tape showing `words` with the sizes above, VIEW wide: the lead is 40 pixels long, and each word of 5 adds 55. As
     * in a browser, it can't scroll past its length, and it scrolls back as it gets shorter.
     */
    async function tape(
      words: readonly Word[],
    ): Promise<{ fixture: ComponentFixture<TypedDigits>; host: HTMLElement }> {
      const fixture = TestBed.createComponent(TypedDigits);
      const host = fixture.nativeElement as HTMLElement;
      let position = 0;
      const length = (): number => {
        const element = host.querySelector<HTMLElement>('.words');
        const end = element?.lastElementChild?.getBoundingClientRect().right ?? 0;
        return end + (parseFloat(element?.style.getPropertyValue('--room') ?? '') || 0);
      };
      const end = (): number => Math.max(0, length() - VIEW);
      Object.defineProperty(host, 'scrollLeft', {
        get: () => Math.min(position, end()),
        set: (value: number) => {
          position = Math.min(end(), Math.max(0, value));
        },
      });
      Object.defineProperty(host, 'scrollWidth', { get: () => Math.max(VIEW, length()) });
      Object.defineProperty(host, 'clientWidth', { get: () => VIEW });
      await put(fixture, words);
      settle(host);
      time = 0;
      return { fixture, host };
    }

    /** Words of 5 digits, then words of the other `sizes`. */
    function wordsOf(fives: number, ...sizes: number[]): readonly Word[] {
      const all = [...Array.from({ length: fives }, () => 5), ...sizes];
      return groupDigits(
        PI_DECIMALS.slice(
          0,
          all.reduce((sum, size) => sum + size, 0),
        ),
        all,
      ).words;
    }

    async function put(
      fixture: ComponentFixture<TypedDigits>,
      words: readonly Word[],
    ): Promise<void> {
      const digits = words.map((word) => word.digits).join('');
      fixture.componentRef.setInput('words', words);
      fixture.componentRef.setInput('digits', digits);
      fixture.componentRef.setInput('colors', placeColors(digits));
      await fixture.whenStable();
    }

    /** Runs the pending animation frames at `at` ms, and returns the scroll position after them. */
    function frameAt(host: HTMLElement, at: number): number {
      time = at;
      for (const frame of frames.splice(0)) {
        frame(at);
      }
      return host.scrollLeft;
    }

    /** Runs the animation frames until the tape stops, and returns where it stopped. */
    function settle(host: HTMLElement): number {
      return frameAt(host, time + 10_000);
    }

    it('stays at the start while the words fit, then makes room for each word as it comes on, done as the first slot lands', async () => {
      const { fixture, host } = await tape(wordsOf(2));
      expect(host.scrollLeft).toBe(0);

      await put(fixture, wordsOf(4));

      const positions = [100, 300, 500].map((at) => frameAt(host, at));
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      expect(positions[0]).toBeGreaterThan(0);
      expect(positions[2]).toBeLessThan(60);
      expect(frameAt(host, FIRST_LANDING)).toBe(60);
    });

    it('arrives sooner when asked, picking up from where it is, and says how far the words have left to move', async () => {
      const { fixture, host } = await tape(wordsOf(2));
      await put(fixture, wordsOf(4));
      const halfway = frameAt(host, 275);

      expect(fixture.componentInstance.scrollToEnd(100)).toBeCloseTo(60 - halfway);
      expect(frameAt(host, 325)).toBeGreaterThan(halfway);
      expect(frameAt(host, 375)).toBe(60);
    });

    it("leaves room for a word taken off, so that the tape doesn't move", async () => {
      const { fixture, host } = await tape(wordsOf(5));
      expect(host.scrollLeft).toBe(115);

      await put(fixture, wordsOf(4));

      expect(settle(host)).toBe(115);
    });

    it('scrolls back by that room as the next word is taken off, and leaves room for that one', async () => {
      const { fixture, host } = await tape(wordsOf(5));
      await put(fixture, wordsOf(4));

      settle(host);
      const start = time;

      await put(fixture, wordsOf(3));

      expect(host.scrollLeft).toBe(115);
      const halfway = frameAt(host, start + SCROLL_BACK_DURATION / 2);
      expect(halfway).toBeGreaterThan(60);
      expect(halfway).toBeLessThan(115);
      expect(frameAt(host, start + SCROLL_BACK_DURATION)).toBe(60);
      expect(settle(host)).toBe(60);
    });

    it('keeps the room for a word as it comes back shorter, and is taken off again', async () => {
      const { fixture, host } = await tape(wordsOf(5));

      await put(fixture, wordsOf(4, 4));
      expect(settle(host)).toBe(115);
      await put(fixture, wordsOf(4, 3));
      expect(settle(host)).toBe(115);
      await put(fixture, wordsOf(4));
      expect(settle(host)).toBe(115);
    });

    it('lets a word put on take up the room left before making more', async () => {
      const { fixture, host } = await tape(wordsOf(5));
      await put(fixture, wordsOf(4));

      await put(fixture, wordsOf(4, 3));
      expect(settle(host)).toBe(115);
      await put(fixture, wordsOf(4, 3, 5));
      expect(settle(host)).toBe(150);
    });

    it('leaves no room when words are all taken off at once, as the game restarts', async () => {
      const { fixture, host } = await tape(wordsOf(5));

      await put(fixture, []);

      expect(settle(host)).toBe(0);
    });

    it('fades out an edge once words hide past it: the right one only once the player scrolls back', async () => {
      const { fixture, host } = await tape(wordsOf(2));
      expect(host.classList).not.toContain('hidden-left');

      await put(fixture, wordsOf(5));
      settle(host);
      await put(fixture, wordsOf(4));
      settle(host);
      await fixture.whenStable();
      expect(host.classList).toContain('hidden-left');
      expect(host.classList).not.toContain('hidden-right');

      host.scrollLeft = 0;
      host.dispatchEvent(new Event('scroll'));
      await fixture.whenStable();
      expect(host.classList).not.toContain('hidden-left');
      expect(host.classList).toContain('hidden-right');
    });

    it('glides back to the newest words when asked, as typing does', async () => {
      const { fixture, host } = await tape(wordsOf(5));
      host.scrollLeft = 0;

      fixture.componentInstance.scrollToEnd(SCROLL_BACK_DURATION);

      expect(frameAt(host, SCROLL_BACK_DURATION / 2)).toBeGreaterThan(0);
      expect(frameAt(host, SCROLL_BACK_DURATION)).toBe(115);
    });

    it('jumps at once when the player prefers reduced motion', async () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      const { fixture, host } = await tape(wordsOf(2));

      await put(fixture, wordsOf(4));

      expect(host.scrollLeft).toBe(60);
    });
  });
});
