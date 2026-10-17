import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { installPopovers, uninstallPopovers } from '../../testing/fake-popovers';
import { ContextMenu, MenuEntry, MenuItem, SEPARATOR, shownEntries } from './context-menu';

describe('shownEntries', () => {
  const item = (label: string): MenuItem => ({ label, action: () => undefined });
  const a = item('A');
  const b = item('B');

  it('keeps a separator between two items', () => {
    expect(shownEntries([a, SEPARATOR, b])).toEqual([a, SEPARATOR, b]);
  });

  it('leaves out a separator with nothing to separate on either side', () => {
    expect(shownEntries([SEPARATOR, a])).toEqual([a]);
    expect(shownEntries([a, SEPARATOR])).toEqual([a]);
    expect(shownEntries([SEPARATOR])).toEqual([]);
    expect(shownEntries([SEPARATOR, SEPARATOR, a, SEPARATOR, SEPARATOR])).toEqual([a]);
  });

  it('draws only one separator between the same two items', () => {
    expect(shownEntries([a, SEPARATOR, SEPARATOR, b])).toEqual([a, SEPARATOR, b]);
  });
});

@Component({
  imports: [ContextMenu],
  template: `<app-context-menu [entries]="entries()" />`,
})
class Host {
  readonly entries = signal<readonly MenuEntry[]>([]);
  readonly menu = viewChild.required(ContextMenu);
}

describe('ContextMenu', () => {
  let host: Host;
  let element: HTMLElement;
  let chosen: string[];

  beforeEach(async () => {
    installPopovers();
    chosen = [];
    const fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    element = fixture.nativeElement as HTMLElement;
    const item = (label: string): MenuItem => ({
      label,
      action: () => {
        chosen.push(label);
      },
    });
    host.entries.set([SEPARATOR, item('Delete'), SEPARATOR, item('Play'), SEPARATOR]);
    await fixture.whenStable();
  });

  afterEach(uninstallPopovers);

  function sheet(): HTMLElement {
    const found = element.querySelector<HTMLElement>('app-context-menu [popover]');
    if (found === null) {
      throw new Error('No menu');
    }
    return found;
  }

  it('draws separators only between items', () => {
    expect(Array.from(sheet().children, (child) => child.textContent.trim() || 'line')).toEqual([
      'Delete',
      'line',
      'Play',
    ]);
  });

  it('opens where it was asked to, ready for the keyboard', () => {
    const focus = vi.spyOn(HTMLButtonElement.prototype, 'focus');

    host.menu().open({ x: 40, y: 50 });

    expect(sheet().hasAttribute('data-popover-open')).toBe(true);
    expect(sheet().style.top).toBe('58px');
    expect(focus.mock.contexts.map((button) => (button as HTMLButtonElement).textContent)).toEqual([
      'Delete',
    ]);
  });

  it('closes and does what an item says once chosen', () => {
    host.menu().open({ x: 40, y: 50 });

    sheet().querySelectorAll('button')[1]?.click();

    expect(sheet().hasAttribute('data-popover-open')).toBe(false);
    expect(chosen).toEqual(['Play']);
  });
});
