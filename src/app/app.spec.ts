import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter } from '@angular/router';
import { App } from './app';
import { Background } from './ui/background';
import { SEASON_COLOR_SPACE, seasonAt } from './game/layers/seasons';
import { zoom } from './app.config';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('lays the background out behind every screen, in the colors it shows', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const main = (fixture.nativeElement as HTMLElement).querySelector('main');
    const shown = TestBed.inject(Background).shown();

    expect(shown).toEqual(seasonAt(0).background);
    expect(main?.classList).toContain('season-background');
    expect(main?.style.getPropertyValue('--background-top')).toBe(shown[0]);
    expect(main?.style.getPropertyValue('--background-bottom')).toBe(shown[1]);
    expect(main?.style.getPropertyValue('--background-space')).toBe(SEASON_COLOR_SPACE);
  });

  it('gives a solid candy button the focus under the mouse, and only a solid one that takes it', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button class="candy">Candy</button><button class="frosted">Frosted</button>' +
        '<button class="candy clear">Clear</button>' +
        '<button class="candy unfocusable" tabindex="-1">Key</button>',
    );
    const [candy, frosted, clear, key] = Array.from(
      document.querySelectorAll<HTMLElement>('.candy, .frosted'),
    );
    const hover = (target: Element | undefined, pointerType: string): void => {
      target?.dispatchEvent(
        Object.assign(new MouseEvent('pointerover', { bubbles: true }), { pointerType }),
      );
    };

    hover(candy, 'touch');
    expect(document.activeElement).not.toBe(candy);
    hover(candy, 'mouse');
    expect(document.activeElement).toBe(candy);
    hover(frosted, 'mouse');
    expect(document.activeElement).toBe(candy);
    hover(clear, 'mouse');
    expect(document.activeElement).toBe(candy);
    hover(key, 'mouse');
    expect(document.activeElement).toBe(candy);

    candy?.remove();
    frosted?.remove();
    clear?.remove();
    key?.remove();
  });

  it('keeps the long-press menu from opening anywhere', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('lets text fields open their long-press menu, to paste', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const field = document.createElement('textarea');
    document.body.append(field);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    field.dispatchEvent(event);
    field.remove();

    expect(event.defaultPrevented).toBe(false);
  });

  it('keeps anything from being dragged', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const link = document.createElement('a');
    link.href = '/play';
    document.body.append(link);
    const event = new Event('dragstart', { bubbles: true, cancelable: true });

    link.dispatchEvent(event);
    link.remove();

    expect(event.defaultPrevented).toBe(true);
  });

  it('renders a main landmark with a router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('main router-outlet')).not.toBeNull();
  });
});

describe('routes', () => {
  it('opens on the main menu', async () => {
    const root = routes.find((route) => route.path === '');
    const { Menu } = await import('./screens/menu/menu');
    expect(root?.component).toBe(Menu);
  });

  it('lazily loads the play screen', async () => {
    const play = routes.find((route) => route.path === 'play');
    const component = await play?.loadComponent?.();
    const { Play } = await import('./screens/play/play');
    expect(component).toBe(Play);
  });

  it("lazily loads the player's runs", async () => {
    const runs = routes.find((route) => route.path === 'runs');
    const component = await runs?.loadComponent?.();
    const { YourRuns } = await import('./screens/your-runs/your-runs');
    expect(component).toBe(YourRuns);
  });

  it("lazily loads the player's data", async () => {
    const data = routes.find((route) => route.path === 'data');
    const component = await data?.loadComponent?.();
    const { Data } = await import('./screens/your-data/data');
    expect(component).toBe(Data);
  });

  it("lazily loads what stands in for a preview that isn't published", async () => {
    const preview = routes.find((route) => route.matcher !== undefined);
    const component = await preview?.loadComponent?.();
    const { MissingPreview } = await import('./screens/missing-preview/missing-preview');
    expect(component).toBe(MissingPreview);
  });

  it('sends unknown addresses to the main menu', () => {
    expect(routes.find((route) => route.path === '**')?.redirectTo).toBe('');
  });
});

describe('zoom', () => {
  function transitionTo(path: string | undefined): Set<string> {
    const types = new Set<string>();
    zoom({
      transition: { types } as unknown as ViewTransition,
      from: {} as ActivatedRouteSnapshot,
      to: { firstChild: { routeConfig: { path } } } as unknown as ActivatedRouteSnapshot,
    });
    return types;
  }

  it('zooms in when a game starts', () => {
    expect([...transitionTo('play')]).toEqual(['zoom-in']);
  });

  it("zooms in when the player's data opens", () => {
    expect([...transitionTo('data')]).toEqual(['zoom-in']);
  });

  it('zooms out back to the main menu', () => {
    expect([...transitionTo('')]).toEqual(['zoom-out']);
  });

  it('only cross-fades where view transitions have no types', () => {
    expect(() => {
      zoom({
        transition: {} as ViewTransition,
        from: {} as ActivatedRouteSnapshot,
        to: {} as ActivatedRouteSnapshot,
      });
    }).not.toThrow();
  });
});
