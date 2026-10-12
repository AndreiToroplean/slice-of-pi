import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Page } from './page';

@Component({ imports: [Page], template: `<app-page title="A page" />` })
class APage {}

describe('Page', () => {
  it('shows the title, and goes back to the main menu', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'page', component: APage },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create('/page');
    const host = harness.routeNativeElement;

    expect(host?.querySelector('h1')?.textContent).toBe('A page');
    host?.querySelector<HTMLButtonElement>('button[aria-label="Back"]')?.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/');
  });
});
