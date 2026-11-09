import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter } from '@angular/router';
import { App } from './app';
import { Background } from './ui/background';
import { TWILIGHT } from './screens/menu/menu-look';
import { SEASON_COLOR_SPACE } from './game/layers/seasons';
import { zoom } from './app.config';
import { routes } from './app.routes';
import { VIBRATE } from './feedback/vibrator';
import { VIBRATION_PATTERNS } from './feedback/vibrations';
import { FakeAudio } from '../testing/fake-audio';

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

    expect(shown).toEqual(TWILIGHT);
    expect(main?.classList).toContain('season-background');
    expect(main?.style.getPropertyValue('--background-top')).toBe(shown[0]);
    expect(main?.style.getPropertyValue('--background-bottom')).toBe(shown[1]);
    expect(main?.style.getPropertyValue('--background-space')).toBe(SEASON_COLOR_SPACE);
  });

  it('gets the audio ready on the first tap anywhere, before any sound', async () => {
    const audio = new FakeAudio();
    TestBed.configureTestingModule({ providers: audio.providers });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(audio.made).toBe(0);

    document.body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    expect(audio.made).toBe(1);
  });

  it('vibrates as a button anywhere is clicked', async () => {
    const vibrated: (number | number[])[] = [];
    TestBed.overrideProvider(VIBRATE, {
      useValue: (pattern: number | number[]) => {
        vibrated.push(pattern);
      },
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const button = document.createElement('button');
    document.body.append(button);
    onTestFinished(() => {
      button.remove();
    });

    button.click();

    expect(vibrated).toEqual([[...VIBRATION_PATTERNS.button]]);
  });

  it('gives a solid candy button the focus under the mouse, and only a solid one that takes it', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button class="candy">Candy</button><button class="frosted">Frosted</button>' +
        '<button class="candy clear">Clear</button>' +
        '<button class="candy unfocusable" tabindex="-1">Key</button>' +
        '<div class="candy"><span role="spinbutton" tabindex="0">40</span></div>',
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
    // A part of a button holding a spinner gives it the focus.
    const spinner = document.querySelector('[role="spinbutton"]') ?? undefined;
    hover(spinner, 'mouse');
    expect(document.activeElement).toBe(spinner);
    spinner?.parentElement?.remove();

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

  it('renders a main landmark with a router outlet', { tags: ['disabled'] }, async () => {
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

  it('skips the transition without motion, the next screen showing at once', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
    const skipTransition = vi.fn();

    zoom({
      transition: { types: new Set(), skipTransition } as unknown as ViewTransition,
      from: {} as ActivatedRouteSnapshot,
      to: { firstChild: { routeConfig: { path: 'play' } } } as unknown as ActivatedRouteSnapshot,
    });

    expect(skipTransition).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
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
