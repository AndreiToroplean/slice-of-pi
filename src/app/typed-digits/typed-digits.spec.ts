import { ComponentFixture, TestBed } from '@angular/core/testing';
import { groupDigits } from '../groups/groups';
import { PALETTE, placeColors } from '../place-colors/place-colors';
import { SCROLL_DOWN_DURATION, TypedDigits } from './typed-digits';

describe('TypedDigits', () => {
  async function render(digits: string): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(TypedDigits);
    fixture.componentRef.setInput('words', groupDigits(digits).words);
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
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    /** Typed digits scrolled `up` pixels above the bottom, the way a reversed column scrolls: 0 at the bottom. */
    async function scrolledUp(
      up: number,
    ): Promise<{ fixture: ComponentFixture<TypedDigits>; host: HTMLElement }> {
      const fixture = TestBed.createComponent(TypedDigits);
      const host = fixture.nativeElement as HTMLElement;
      let position = 0 - up;
      Object.defineProperty(host, 'scrollTop', {
        get: () => position,
        set: (value: number) => {
          position = Math.min(0, Math.max(0 - up, value));
        },
      });
      fixture.componentRef.setInput('words', []);
      fixture.componentRef.setInput('digits', '14');
      fixture.componentRef.setInput('colors', placeColors('14'));
      await fixture.whenStable();
      return { fixture, host };
    }

    async function type(fixture: ComponentFixture<TypedDigits>, digits: string): Promise<void> {
      fixture.componentRef.setInput('words', groupDigits(digits).words);
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
      return host.scrollTop;
    }

    it('glides smoothly back down to the newest words as the player types', async () => {
      const { fixture, host } = await scrolledUp(300);

      await type(fixture, '141');

      const positions = [100, 200, 300, 399].map((at) => frameAt(host, at));
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      expect(positions[1]).toBeCloseTo(-150);
      expect(frameAt(host, SCROLL_DOWN_DURATION)).toBe(0);
    });

    it("doesn't move when already at the bottom", async () => {
      const { fixture, host } = await scrolledUp(0);

      await type(fixture, '141');

      expect(frameAt(host, 100)).toBe(0);
      expect(fixture.componentInstance.scrollDown(100)).toBe(0);
    });

    it('arrives sooner when asked, picking up from where it is, and says how far it has left to go', async () => {
      const { fixture, host } = await scrolledUp(300);
      await type(fixture, '141');
      const halfway = frameAt(host, 200);

      expect(fixture.componentInstance.scrollDown(100)).toBeCloseTo(-halfway);
      expect(frameAt(host, 250)).toBeGreaterThan(halfway);
      expect(frameAt(host, 300)).toBe(0);
    });

    /** Typed digits at the bottom, whose words are as tall as `height()`. */
    async function sized(
      height: () => number,
    ): Promise<{ fixture: ComponentFixture<TypedDigits>; words: HTMLElement }> {
      const fixture = TestBed.createComponent(TypedDigits);
      const host = fixture.nativeElement as HTMLElement;
      Object.defineProperty(host, 'scrollTop', { get: () => 0, set: () => undefined });
      fixture.componentRef.setInput('words', groupDigits('1415').words);
      fixture.componentRef.setInput('digits', '1415');
      fixture.componentRef.setInput('colors', placeColors('1415'));
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return this.classList.contains('words') ? height() : 0;
      });
      await fixture.whenStable();
      const words = host.querySelector<HTMLElement>('.words');
      if (words === null) {
        throw new Error('No words');
      }
      return { fixture, words };
    }

    /** How much lower than their place the words are drawn, in pixels. */
    function lowered(words: HTMLElement): number {
      return Number(/^0 (.+)px$/.exec(words.style.translate)?.[1] ?? 0);
    }

    it('slides a new row of words in, rather than pushing the words up at once', async () => {
      let height = 100;
      const { fixture, words } = await sized(() => height);

      height = 120;
      await type(fixture, '14159');

      expect(lowered(words)).toBe(20);
      const positions = [100, 200, 300].map((at) => {
        frameAt(words, at);
        return lowered(words);
      });
      expect(positions).toEqual([...positions].sort((a, b) => b - a));
      expect(positions[1]).toBeCloseTo(10);
      frameAt(words, SCROLL_DOWN_DURATION);
      expect(words.style.translate).toBe('');
    });

    it('says how far a new row has left to slide, so that what flies to it can aim for where it will be', async () => {
      let height = 100;
      const { fixture, words } = await sized(() => height);
      height = 120;
      await type(fixture, '14159');
      frameAt(words, 200);

      expect(fixture.componentInstance.scrollDown(100)).toBeCloseTo(10);
    });

    it("doesn't move when the words don't grow, or shrink", async () => {
      let height = 100;
      const { fixture, words } = await sized(() => height);

      await type(fixture, '14159');
      expect(words.style.translate).toBe('');

      height = 80;
      await type(fixture, '1415');
      expect(words.style.translate).toBe('');
    });

    it('shows a new row at once when the player prefers reduced motion', async () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      let height = 100;
      const { fixture, words } = await sized(() => height);

      height = 120;
      await type(fixture, '14159');

      expect(words.style.translate).toBe('');
    });

    it('jumps down at once when the player prefers reduced motion', async () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      const { fixture, host } = await scrolledUp(300);

      await type(fixture, '141');

      expect(host.scrollTop).toBe(0);
    });
  });
});
