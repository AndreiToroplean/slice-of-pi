import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../app.routes';
import { Background } from '../background/background';
import { seasonAt } from '../seasons/seasons';
import { DeveloperMode } from '../developer/developer-mode';
import { Tweaks } from '../developer/tweaks';
import { INDEXED_DB } from '../runs/run-store';
import { backgroundsFrom } from '../seasons/seasons';
import { Menu } from './menu';

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

  it('brings back the background a new game starts on', async () => {
    TestBed.inject(Background).colors.set(seasonAt(60).background);

    await setUp();

    expect(TestBed.inject(Background).colors()).toEqual(seasonAt(0).background);
  });

  it('starts a game with the play button', async () => {
    const host = await setUp();

    const play = host.querySelector('a.candy');
    expect(play?.textContent.trim()).toBe('Play');
    expect(play?.getAttribute('href')).toBe('/play');
  });

  describe('in developer mode', () => {
    const seasons = {
      spring: ['#000000', '#111111'],
      summer: ['#000000', '#111111'],
      autumn: ['#000000', '#111111'],
      winter: ['#000000', '#111111'],
    } as const;

    function developerSection(host: HTMLElement): Element | null {
      return host.querySelector('.dropdown [role="group"]');
    }

    it('has no developer section until developer mode is on', async () => {
      const fixture = TestBed.createComponent(Menu);
      await fixture.whenStable();
      const host = fixture.nativeElement as HTMLElement;
      expect(developerSection(host)).toBeNull();

      await TestBed.inject(DeveloperMode).set(true);
      await fixture.whenStable();

      expect(developerSection(host)?.querySelector('h2')?.textContent).toBe('Developer');
      expect(
        Array.from(developerSection(host)?.querySelectorAll('a') ?? [], (link) => [
          link.textContent.trim(),
          link.getAttribute('href'),
        ]),
      ).toEqual([
        ['Key Colors', '/developer/key-colors'],
        ['Season Colors', '/developer/season-colors'],
      ]);
    });

    it('turns checking the digits off and on', async () => {
      await TestBed.inject(DeveloperMode).set(true);
      const host = await setUp();
      const toggle = developerSection(host)?.querySelector<HTMLInputElement>(
        'label.toggle input[type="checkbox"]',
      );
      const tweaks = TestBed.inject(Tweaks);
      expect(toggle?.closest('label')?.textContent.trim()).toBe('Check Digits');
      expect(toggle?.checked).toBe(true);

      toggle?.click();
      expect(tweaks.checking()).toBe(false);

      toggle?.click();
      expect(tweaks.checking()).toBe(true);
    });

    it('starts on the tuned background of a new game', async () => {
      await TestBed.inject(DeveloperMode).set(true);
      await TestBed.inject(Tweaks).setSeasons(seasons);

      await setUp();

      expect(TestBed.inject(Background).colors()).toEqual(
        seasonAt(0, backgroundsFrom(seasons)).background,
      );
    });
  });
});
