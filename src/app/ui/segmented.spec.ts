import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Segmented } from './segmented';

@Component({
  imports: [Segmented],
  template: `<app-segmented label="Size" [segments]="segments" [(value)]="size" />`,
})
class Host {
  protected readonly segments = [
    { value: 'small', label: 'Small' },
    { value: 'large', label: 'Large' },
  ] as const;
  readonly size = signal<'small' | 'large'>('small');
}

describe('Segmented', () => {
  async function setUp(): Promise<{ host: HTMLElement; component: Host }> {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { host: fixture.nativeElement as HTMLElement, component: fixture.componentInstance };
  }

  function chosen(host: HTMLElement): string[] {
    return Array.from(host.querySelectorAll('label'))
      .filter((label) => label.querySelector('input')?.checked)
      .map((label) => label.textContent.trim());
  }

  function choose(host: HTMLElement, text: string): void {
    Array.from(host.querySelectorAll('label'))
      .find((label) => label.textContent.trim() === text)
      ?.querySelector('input')
      ?.click();
  }

  it('is a group of choices named for screen readers, with the value given chosen', async () => {
    const { host } = await setUp();

    expect(host.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Size');
    expect(chosen(host)).toEqual(['Small']);
  });

  it('chooses another value when pressed, and stays on a value pressed again', async () => {
    const { host, component } = await setUp();

    choose(host, 'Large');
    expect(component.size()).toBe('large');
    expect(chosen(host)).toEqual(['Large']);

    choose(host, 'Large');
    expect(component.size()).toBe('large');
    expect(chosen(host)).toEqual(['Large']);
  });
});
