import { TestBed } from '@angular/core/testing';
import { pressKey } from '../../../testing/keys';
import { openMenu } from '../../../testing/menus';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { Background, TWILIGHT } from '../../ui/background';
import { seasonAt } from '../../game/layers/seasons';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { INDEXED_DB } from '../../player-data/run-store';
import { Menu } from './menu';
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

  it("announces the game's name in tiles, under its icon", async () => {
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

  it('starts a game with the play button', async () => {
    const host = await setUp();

    expect(link(host, 'Play')?.getAttribute('href')).toBe('/play');
  });

  it('opens the player’s runs', async () => {
    const host = await setUp();

    expect(link(host, 'Your Runs')?.getAttribute('href')).toBe('/runs');
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

    it('gives Play the focus once shown, for Enter to play', async () => {
      const host = await shown();

      expect(document.activeElement).toBe(link(host, 'Play'));
    });

    it('moves the focus back onto Play with up or down once nothing has it, as after a tap', async () => {
      const host = await shown();
      (document.activeElement as HTMLElement).blur();

      expect(press('ArrowUp').defaultPrevented).toBe(true);

      expect(document.activeElement).toBe(link(host, 'Play'));
    });

    it('moves up and down its main buttons only, round from either end', async () => {
      const host = await shown();

      press('ArrowUp');
      expect(focused()).toBe('Your Runs');
      press('ArrowUp');
      expect(focused()).toBe('Play');
      press('ArrowDown');
      expect(focused()).toBe('Your Runs');

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
      expect(focused()).toBe('Play');
      press('ArrowUp');
      expect(press('ArrowRight').defaultPrevented).toBe(false);
      expect(focused()).toBe('Your Runs');
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
          ['Model Tuning', '/developer/model-tuning'],
          ['Key Colors', '/developer/key-colors'],
          ['Season Colors', '/developer/season-colors'],
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
  });
});
