import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Segmented } from './segmented';
import { TabPanel, TabPanels } from './tab-panels';

@Component({
  imports: [Segmented, TabPanel, TabPanels],
  template: `
    <app-segmented
      label="Tabs"
      panels="tabs"
      [segments]="segments"
      [position]="strip.position()"
      [(value)]="tab"
    />
    <app-tab-panels #strip panels="tabs" [(value)]="tab">
      <section appTabPanel="first">First</section>
      <section appTabPanel="second"><button type="button">Second</button></section>
    </app-tab-panels>
  `,
})
class Tabs {
  readonly segments = [
    { value: 'first', label: 'First' },
    { value: 'second', label: 'Second' },
  ] as const;
  readonly tab = signal<'first' | 'second'>('first');
}

describe('TabPanels', () => {
  async function setUp() {
    const fixture = TestBed.createComponent(Tabs);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const strip = host.querySelector<HTMLElement>('app-tab-panels');
    if (strip === null) {
      throw new Error('No panels');
    }
    return { fixture, host, strip };
  }

  it('labels each panel by its tab, only the chosen one open to the focus and screen readers', async () => {
    const { host } = await setUp();
    const panels = Array.from(host.querySelectorAll('[role="tabpanel"]'));

    expect(panels.map((panel) => panel.id)).toEqual(['tabs-first', 'tabs-second']);
    expect(panels.map((panel) => panel.getAttribute('aria-labelledby'))).toEqual([
      'tabs-tab-first',
      'tabs-tab-second',
    ]);
    expect(panels.map((panel) => panel.hasAttribute('inert'))).toEqual([false, true]);
  });

  it('scrolls the chosen tab’s panel into view', async () => {
    const { fixture, host, strip } = await setUp();
    const scrolls: number[] = [];
    Object.defineProperty(strip, 'scrollLeft', {
      set: (left: number) => scrolls.push(left),
    });
    Object.defineProperty(strip, 'clientWidth', { value: 320 });

    host.querySelector<HTMLElement>('#tabs-tab-second')?.click();
    await fixture.whenStable();

    expect(scrolls.at(-1)).toBe(320);
    expect(host.querySelector('#tabs-second')?.hasAttribute('inert')).toBe(false);
  });

  it('chooses the tab of the panel swiped to, once scrolling ends', async () => {
    const { fixture, host, strip } = await setUp();
    Object.defineProperty(strip, 'clientWidth', { value: 320 });
    Object.defineProperty(strip, 'scrollLeft', { value: 320 });

    strip.dispatchEvent(new Event('scrollend'));
    await fixture.whenStable();

    expect(host.querySelector('#tabs-tab-second')?.getAttribute('aria-selected')).toBe('true');
  });

  it('moves the tabs’ pill and their names’ colors along as the panels are swiped, halfway through halfway', async () => {
    const { fixture, host, strip } = await setUp();
    const [first, second] = Array.from(host.querySelectorAll<HTMLElement>('[role="tab"]'));
    Object.defineProperties(first, { offsetLeft: { value: 0 }, offsetWidth: { value: 80 } });
    Object.defineProperties(second, { offsetLeft: { value: 100 }, offsetWidth: { value: 120 } });
    Object.defineProperty(strip, 'clientWidth', { value: 320 });
    Object.defineProperty(strip, 'scrollLeft', { value: 160 });

    strip.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();

    const pill = host.querySelector<HTMLElement>('.chosen-pill');
    expect([pill?.style.translate, pill?.style.width]).toEqual(['50px', '100px']);
    // Each name halfway between the text's color and the pill's.
    expect([first, second].map((tab) => tab?.style.getPropertyValue('--on-pill'))).toEqual([
      '0.5',
      '0.5',
    ]);
    expect(host.querySelector('#tabs-tab-first')?.getAttribute('aria-selected')).toBe('true');
  });
});
