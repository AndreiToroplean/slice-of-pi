import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Page } from './page';

@Component({
  imports: [Page],
  template: `<app-page heading="A page"><dialog>A dialog</dialog></app-page>`,
})
class APage {}

describe('Page', () => {
  async function setUp(): Promise<{ harness: RouterTestingHarness; host: HTMLElement | null }> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'page', component: APage },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create('/page');
    return { harness, host: harness.routeNativeElement };
  }

  function escape(): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    return event;
  }

  it('shows the title, and goes back to the main menu, saying so on hover', async () => {
    const { harness, host } = await setUp();
    const back = host?.querySelector<HTMLButtonElement>('button[title="Back"]');

    expect(host?.querySelector('h1')?.textContent).toBe('A page');
    expect(host?.querySelector('app-page')?.hasAttribute('title')).toBe(false);
    back?.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('goes back to the main menu on Escape', async () => {
    const { harness } = await setUp();

    expect(escape().defaultPrevented).toBe(true);
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('leaves Escape to an open dialog, to close it', async () => {
    const { harness, host } = await setUp();
    host?.querySelector('dialog')?.setAttribute('open', '');

    expect(escape().defaultPrevented).toBe(false);
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/page');
  });
});
