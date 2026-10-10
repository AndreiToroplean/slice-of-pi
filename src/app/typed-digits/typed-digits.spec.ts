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

  it('starts with "3." as a word of two tiles, and no other words', async () => {
    const host = await render('');

    expect(
      Array.from(host.querySelectorAll('.lead .tile'), (tile) => tile.textContent.trim()),
    ).toEqual(['3', '.']);
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
    ).toEqual(['', '']);
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

    it('jumps down at once when the player prefers reduced motion', async () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      const { fixture, host } = await scrolledUp(300);

      await type(fixture, '141');

      expect(host.scrollTop).toBe(0);
    });
  });
});
