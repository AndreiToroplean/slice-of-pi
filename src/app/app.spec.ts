import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter } from '@angular/router';
import { App } from './app';
import { Background } from './background/background';
import { seasonAt } from './seasons/seasons';
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

  it('lays the background out behind every screen, in its colors', async () => {
    const fixture = TestBed.createComponent(App);
    TestBed.inject(Background).colors.set(seasonAt(30).background);
    await fixture.whenStable();
    const main = (fixture.nativeElement as HTMLElement).querySelector('main');

    expect(main?.classList).toContain('season-background');
    expect(main?.style.getPropertyValue('--background-top')).toBe(seasonAt(30).background[0]);
    expect(main?.style.getPropertyValue('--background-bottom')).toBe(seasonAt(30).background[1]);
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
    const component = await root?.loadComponent?.();
    const { Menu } = await import('./menu/menu');
    expect(component).toBe(Menu);
  });

  it('lazily loads the play screen', async () => {
    const play = routes.find((route) => route.path === 'play');
    const component = await play?.loadComponent?.();
    const { Play } = await import('./play/play');
    expect(component).toBe(Play);
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

  it('zooms out when a game ends', () => {
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
