import { TestBed } from '@angular/core/testing';
import { pressKey } from '../../../testing/keys';
import { menuItem, menuItems, openMenu } from '../../../testing/menus';
import { Checkpoint } from '../../player-data/checkpoint';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { Background } from '../../ui/background';
import { TWILIGHT } from './menu-look';
import { seasonAt } from '../../game/layers/seasons';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { INDEXED_DB } from '../../player-data/run-store';
import { LIGHTS_OFF, Menu, RELOAD_PAGE } from './menu';
import { Tweaks } from '../../developer-mode/tweaks';
import { ScreenTransitions } from '../../ui/screen-transitions';
import { PALETTE } from '../../game/layers/place-colors';
import { MenuEditor } from './menu-editor';

describe('Menu', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: INDEXED_DB, useValue: undefined }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setUp(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(Menu);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it("announces the game's name in tiles, under its icon", { tags: ['disabled'] }, async () => {
    const host = await setUp();

    expect(host.querySelector('h1 .visually-hidden')?.textContent).toBe('Slice of Pi');
    const tiles = host.querySelector('h1 [aria-hidden="true"]');
    expect(
      Array.from(tiles?.querySelectorAll('.line') ?? [], (line) =>
        Array.from(line.querySelectorAll('.word'), (word) => word.textContent.replace(/\s/g, '')),
      ),
    ).toEqual([['Slice', 'of'], ['Pi']]);
    expect(host.querySelector('img')?.getAttribute('src')).toBe('icons/icon.webp');
    // Decorative: the heading already names the game.
    expect(host.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('shows once its icon has loaded, and at once when the player comes back to it', async () => {
    const fixture = TestBed.createComponent(Menu);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList).toContain('loading');

    host.querySelector('img')?.dispatchEvent(new Event('load'));
    await fixture.whenStable();
    expect(host.classList).not.toContain('loading');

    const again = TestBed.createComponent(Menu);
    await again.whenStable();
    expect((again.nativeElement as HTMLElement).classList).not.toContain('loading');
  });

  it('lights each letter of the name as a lantern in a key color, every one but lime', async () => {
    const host = await setUp();

    expect(
      Array.from(host.querySelectorAll<HTMLElement>('.tile'), (tile) =>
        tile.style.getPropertyValue('--lantern'),
      ),
    ).toEqual([0, 1, 2, 4, 5, 6, 7, 8, 9].map((at) => PALETTE[at]));
  });

  describe('light', () => {
    const lit = (host: HTMLElement): boolean[] =>
      Array.from(host.querySelectorAll('canvas.light'), (canvas) =>
        canvas.classList.contains('on'),
      );

    async function shown(): Promise<{
      host: HTMLElement;
      menu: Menu;
      stable: () => Promise<void>;
    }> {
      const fixture = TestBed.createComponent(Menu);
      await fixture.whenStable();
      const host = fixture.nativeElement as HTMLElement;
      host.querySelector('img')?.dispatchEvent(new Event('load'));
      await fixture.whenStable();
      return { host, menu: fixture.componentInstance, stable: () => fixture.whenStable() };
    }

    it('switches on once the menu shows, every layer', async () => {
      const fixture = TestBed.createComponent(Menu);
      await fixture.whenStable();
      const host = fixture.nativeElement as HTMLElement;
      expect(lit(host)).toEqual([false, false, false]);

      host.querySelector('img')?.dispatchEvent(new Event('load'));
      await fixture.whenStable();
      expect(lit(host)).toEqual([true, true, true]);
    });

    it('waits for the transition from another screen to finish', async () => {
      let finish = (): void => undefined;
      TestBed.inject(ScreenTransitions).began(new Promise<void>((resolve) => (finish = resolve)));
      const { host, stable } = await shown();
      expect(lit(host)).toEqual([false, false, false]);

      finish();
      await vi.waitFor(async () => {
        await stable();
        expect(lit(host)).toEqual([true, true, true]);
      });
    });

    it('switches off before another screen comes in, letting it come once they are off', async () => {
      const { host, menu } = await shown();
      vi.useFakeTimers();
      onTestFinished(() => {
        vi.useRealTimers();
      });
      let off = false;

      void menu.switchOff().then(() => (off = true));
      await vi.advanceTimersByTimeAsync(LIGHTS_OFF - 1);
      expect(lit(host)).toEqual([false, false, false]);
      expect(off).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(off).toBe(true);
    });
  });

  it('shows the background colors tuned for it in developer mode', async () => {
    await TestBed.inject(DeveloperMode).set(true);
    await TestBed.inject(Tweaks).setTwilight(['#000000', '#ffffff']);

    await setUp();

    expect(TestBed.inject(Background).colors()).toEqual(['#000000', '#ffffff']);
  });

  it('leads to the settings', async () => {
    const host = await setUp();

    expect(host.querySelector('a[title="Settings"]')?.getAttribute('href')).toBe('/settings');
  });

  it('shows even when its icon fails to load', async () => {
    const fixture = TestBed.createComponent(Menu);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    host.querySelector('img')?.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(host.classList).not.toContain('loading');
  });

  it('brings back its twilight sky, whatever season the player left', async () => {
    TestBed.inject(Background).colors.set(seasonAt(60).background);

    await setUp();

    expect(TestBed.inject(Background).colors()).toEqual(TWILIGHT);
  });

  function link(host: HTMLElement, label: string): HTMLAnchorElement | undefined {
    return Array.from(host.querySelectorAll('a')).find(
      (anchor) => anchor.textContent.trim() === label,
    );
  }

  it('starts a game in free play, or a challenge', async () => {
    const host = await setUp();

    expect(link(host, 'Free Play')?.getAttribute('href')).toBe('/play');
    expect(link(host, 'Challenge')?.getAttribute('href')).toBe('/challenge');
  });

  describe('the checkpoint games start from', () => {
    function picker(host: HTMLElement): HTMLButtonElement | null {
      return host.querySelector('button[title="Start From"]');
    }

    it('is offered only once the player has unlocked a checkpoint', async () => {
      expect(picker(await setUp())).toBeNull();
    });

    it('shows the place games start from, and picks another unlocked', async () => {
      const checkpoint = TestBed.inject(Checkpoint);
      vi.spyOn(checkpoint, 'refresh').mockImplementation(() => {
        checkpoint.unlocked.set([50, 100]);
        return Promise.resolve();
      });
      const fixture = TestBed.createComponent(Menu);
      await fixture.whenStable();
      const host = fixture.nativeElement as HTMLElement;
      expect(picker(host)?.textContent.trim()).toBe('0');

      picker(host)?.click();
      await fixture.whenStable();
      expect(menuItems()).toEqual(['Start of π', 'Place 50', 'Place 100']);
      menuItem('Place 100').click();
      await fixture.whenStable();

      expect(checkpoint.start()).toBe(100);
      expect(picker(host)?.textContent.trim()).toBe('100');
    });
  });

  describe('from the keyboard', () => {
    async function shown(): Promise<HTMLElement> {
      const fixture = TestBed.createComponent(Menu);
      await fixture.whenStable();
      const host = fixture.nativeElement as HTMLElement;
      host.querySelector('img')?.dispatchEvent(new Event('load'));
      await fixture.whenStable();
      return host;
    }

    function press(key: string): KeyboardEvent {
      return pressKey(key, document.activeElement ?? document.body);
    }

    const focused = (): string | null | undefined =>
      document.activeElement?.getAttribute('aria-label') ??
      document.activeElement?.getAttribute('title') ??
      document.activeElement?.textContent.trim();

    it('gives Challenge the focus once shown, for Enter to play', async () => {
      const host = await shown();

      expect(document.activeElement).toBe(link(host, 'Challenge'));
    });

    it('moves the focus back onto Challenge with up or down once nothing has it, as after a tap', async () => {
      const host = await shown();
      (document.activeElement as HTMLElement).blur();

      expect(press('ArrowUp').defaultPrevented).toBe(true);

      expect(document.activeElement).toBe(link(host, 'Challenge'));
    });

    it('moves up and down its main buttons only, round from either end', async () => {
      const host = await shown();

      press('ArrowUp');
      expect(focused()).toBe('Free Play');
      press('ArrowUp');
      expect(focused()).toBe('Challenge');
      press('ArrowDown');
      expect(focused()).toBe('Free Play');

      host.querySelector<HTMLElement>('[title="Settings"]')?.focus();
      expect(press('ArrowDown').defaultPrevented).toBe(false);
      expect(focused()).toBe('Settings');
    });

    it('goes from one group of buttons to the next with left and right, as with Tab', async () => {
      await shown();

      press('ArrowLeft');
      expect(focused()).toBe('Slice of Pi');
      press('ArrowLeft');
      expect(focused()).toBe('Settings');
      expect(press('ArrowLeft').defaultPrevented).toBe(false);
      press('ArrowRight');
      press('ArrowRight');
      expect(focused()).toBe('Challenge');
      press('ArrowUp');
      expect(press('ArrowRight').defaultPrevented).toBe(false);
      expect(focused()).toBe('Free Play');
      press('ArrowLeft');
      expect(focused()).toBe('Slice of Pi');
    });
  });

  describe('in developer mode', () => {
    it('has an overflow menu of developer pages, only once developer mode is on', async () => {
      const fixture = TestBed.createComponent(Menu);
      await fixture.whenStable();
      const host = fixture.nativeElement as HTMLElement;
      const overflow = (): HTMLButtonElement | null =>
        host.querySelector('button[title="Developer Pages"]');
      expect(overflow()).toBeNull();

      await TestBed.inject(DeveloperMode).set(true);
      await vi.waitFor(async () => {
        await fixture.whenStable();
        expect(overflow()).not.toBeNull();
      });
      overflow()?.click();
      await fixture.whenStable();

      const section = openMenu()?.querySelector('[role="group"]');
      expect(openMenu()?.getAttribute('aria-labelledby')).toBe('developer-title');
      expect(section?.querySelector('h2')?.textContent).toBe('Developer');
      expect(
        Array.from(section?.querySelectorAll('a') ?? [], (link) => [
          link.textContent.trim(),
          link.getAttribute('href'),
        ]),
      ).toEqual(
        expect.arrayContaining([
          ['Break Models', '/developer/break-models'],
          ['Sound Models', '/developer/sound-models'],
          ['Key Colors', '/developer/key-colors'],
          ['Background Colors', '/developer/background-colors'],
        ]),
      );
    });

    it('opens the editor of its look from the overflow menu, and closes it once done', async () => {
      await TestBed.inject(DeveloperMode).set(true);
      const fixture = TestBed.createComponent(Menu);
      const host = fixture.nativeElement as HTMLElement;
      await vi.waitFor(async () => {
        await fixture.whenStable();
        expect(host.querySelector('button[title="Developer Pages"]')).not.toBeNull();
      });
      host.querySelector<HTMLButtonElement>('button[title="Developer Pages"]')?.click();
      await fixture.whenStable();

      Array.from(openMenu()?.querySelectorAll('button') ?? [])
        .find((each) => each.textContent.trim() === 'Edit Main Menu')
        ?.click();
      await fixture.whenStable();
      expect(
        fixture.debugElement.query((each) => each.componentInstance instanceof MenuEditor),
      ).not.toBeNull();

      Array.from(host.querySelectorAll('app-menu-editor button'))
        .find((each) => each.textContent.trim() === 'Done')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await fixture.whenStable();
      expect(host.querySelector('app-menu-editor')).toBeNull();
    });

    it('reloads the page from the overflow menu', async () => {
      const reload = vi.fn();
      TestBed.overrideProvider(RELOAD_PAGE, { useValue: reload });
      await TestBed.inject(DeveloperMode).set(true);
      const fixture = TestBed.createComponent(Menu);
      const host = fixture.nativeElement as HTMLElement;
      await vi.waitFor(async () => {
        await fixture.whenStable();
        expect(host.querySelector('button[title="Developer Pages"]')).not.toBeNull();
      });
      host.querySelector<HTMLButtonElement>('button[title="Developer Pages"]')?.click();
      await fixture.whenStable();

      Array.from(openMenu()?.querySelectorAll('button') ?? [])
        .find((each) => each.textContent.trim() === 'Reload')
        ?.click();

      expect(reload).toHaveBeenCalledOnce();
    });
  });
});
