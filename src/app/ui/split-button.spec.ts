import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Candy } from './candy';
import { ITEMS_RISE, SplitButton, TRAY_STRETCH } from './split-button';

@Component({
  imports: [Candy, SplitButton],
  template: `
    <app-split-button #split="splitButton" label="More" [(open)]="open">
      <button type="button" appCandy>Main</button>
      <div><button type="button" appCandy [pressed]="!split.risen() || undefined">One</button></div>
      <div><button type="button" appCandy [pressed]="!split.risen() || undefined">Two</button></div>
    </app-split-button>
  `,
})
class Host {
  readonly open = signal(false);
}

describe('SplitButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setUp(): {
    host: HTMLElement;
    toggle: HTMLButtonElement;
    items: HTMLElement[];
    step: (ms: number) => void;
  } {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const step = (ms: number): void => {
      vi.advanceTimersByTime(ms);
      fixture.detectChanges();
    };
    return {
      host,
      toggle: host.querySelector<HTMLButtonElement>('.toggle') ?? document.createElement('button'),
      items: Array.from(host.querySelectorAll<HTMLElement>('.below .candy')),
      step,
    };
  }

  function split(host: HTMLElement): HTMLElement {
    return host.querySelector('app-split-button') ?? host;
  }

  it('opens: the tray stretches down, its small button pressed, then the buttons rise out of it', () => {
    const { host, toggle, items, step } = setUp();
    expect(items).toHaveLength(2);
    expect(split(host).querySelector('.below')?.hasAttribute('inert')).toBe(true);

    toggle.click();
    step(0);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.classList).toContain('pressed');
    expect(split(host).classList).toContain('stretched');
    // Room for both buttons.
    expect(split(host).style.getPropertyValue('--items')).toBe('2');
    expect(items[0]?.classList).toContain('pressed');

    step(TRAY_STRETCH);
    expect(split(host).classList).toContain('risen');
    expect(items[0]?.classList).not.toContain('pressed');
    expect(split(host).querySelector('.below')?.hasAttribute('inert')).toBe(false);
  });

  it('closes: the buttons sink back first, then the tray goes back up', () => {
    const { host, toggle, items, step } = setUp();
    toggle.click();
    step(TRAY_STRETCH);

    toggle.click();
    step(0);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(items[1]?.classList).toContain('pressed');
    expect(split(host).classList).toContain('stretched');

    step(ITEMS_RISE);
    expect(split(host).classList).not.toContain('stretched');
  });

  it('has no small button unless it can open', () => {
    const fixture = TestBed.createComponent(SplitButton);
    fixture.componentRef.setInput('label', 'More');
    fixture.componentRef.setInput('openable', false);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.toggle')).toBeNull();
  });
});
