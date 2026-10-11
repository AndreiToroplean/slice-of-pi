import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../app.routes';
import { Background } from '../background/background';
import { seasonAt } from '../seasons/seasons';
import { Menu } from './menu';

describe('Menu', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
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

  it("has an overflow menu in a corner, with a link to the player's data", async () => {
    const host = await setUp();

    const more = host.querySelector('button.more');
    expect(more?.getAttribute('aria-label')).toBe('More');
    const dropdown = host.querySelector(`#${more?.getAttribute('popovertarget') ?? ''}`);
    expect(dropdown?.hasAttribute('popover')).toBe(true);
    const links = Array.from(dropdown?.querySelectorAll('a') ?? [], (link) => [
      link.textContent.trim(),
      link.getAttribute('href'),
    ]);
    expect(links).toEqual([['Your data', '/data']]);
  });

  it('opens the overflow menu just under its button', async () => {
    const fixture = TestBed.createComponent(Menu);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const more = host.querySelector('button.more');
    const dropdown = host.querySelector<HTMLElement>('.dropdown');
    if (more === null || dropdown === null) {
      throw new Error('No overflow menu');
    }
    more.getBoundingClientRect = () => new DOMRect(300, 10, 44, 44);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(360);

    dropdown.dispatchEvent(new Event('beforetoggle'));
    await fixture.whenStable();

    expect(dropdown.style.top).toBe('60px');
    expect(dropdown.style.right).toBe('16px');
  });

  it('starts a game with the play button', async () => {
    const host = await setUp();

    const play = host.querySelector('a.candy');
    expect(play?.textContent.trim()).toBe('Play');
    expect(play?.getAttribute('href')).toBe('/play');
  });
});
