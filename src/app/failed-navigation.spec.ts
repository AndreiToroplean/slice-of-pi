import { APP_BASE_HREF } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withNavigationErrorHandler } from '@angular/router';
import { LOAD_PAGE, loadFailedPage } from './failed-navigation';

@Component({ template: '' })
class Screen {}

/** A screen whose code is gone from the server, as after a new release. */
function gone(): Promise<never> {
  return Promise.reject(new TypeError('Failed to fetch dynamically imported module'));
}

describe('loadFailedPage', () => {
  let loaded: string[];

  beforeEach(() => {
    loaded = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: '', component: Screen },
            { path: 'runs', loadComponent: gone },
          ],
          withNavigationErrorHandler(loadFailedPage),
        ),
        { provide: APP_BASE_HREF, useValue: '/slice-of-pi/' },
        { provide: LOAD_PAGE, useValue: (url: string) => loaded.push(url) },
      ],
    });
  });

  it("loads the page afresh when a screen's code can't be fetched", async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');

    await router.navigateByUrl('/runs').catch(() => false);

    expect(loaded).toEqual(['/slice-of-pi/runs']);
  });

  it("doesn't reload when the first screen fails to open, so it never reloads over and over", async () => {
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/runs').catch(() => false);

    expect(loaded).toEqual([]);
  });
});
