import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders a main landmark with a router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('main router-outlet')).not.toBeNull();
  });
});

describe('routes', () => {
  it('lazily loads the play screen at the root', async () => {
    const root = routes.find((route) => route.path === '');
    const component = await root?.loadComponent?.();
    const { Play } = await import('./play/play');
    expect(component).toBe(Play);
  });
});
