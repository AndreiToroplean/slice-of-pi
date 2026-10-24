import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { installPopovers, uninstallPopovers } from '../../testing/fake-popovers';
import { DropdownMenu } from './dropdown-menu';

@Component({
  imports: [DropdownMenu],
  template: `
    <app-dropdown-menu>
      <button type="button" disabled>Chosen</button>
      <button type="button">Choose</button>
      <label class="toggle"><input type="checkbox" /> Toggle</label>
    </app-dropdown-menu>
  `,
})
class Host {}

describe('DropdownMenu', () => {
  beforeEach(installPopovers);
  afterEach(uninstallPopovers);

  function open(): { dropdown: HTMLElement; host: HTMLElement } {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const dropdown = host.querySelector<HTMLElement>('.dropdown');
    if (dropdown === null) {
      throw new Error('No dropdown');
    }
    dropdown.showPopover();
    return { dropdown, host };
  }

  it('opens the dropdown from its button', () => {
    const { dropdown, host } = open();

    expect(host.querySelector('button.more')?.getAttribute('popovertarget')).toBe(dropdown.id);
  });

  it('closes once one of its buttons is chosen', () => {
    const { dropdown } = open();

    dropdown.querySelector<HTMLButtonElement>('button:enabled')?.click();

    expect(dropdown.hasAttribute('data-popover-open')).toBe(false);
  });

  function press(key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    document.activeElement?.dispatchEvent(event);
    return event;
  }

  it('opens with the focus on its first item it can take, moved on with the up and down keys', () => {
    const { dropdown } = open();
    const toggle = dropdown.querySelector('input');
    expect(document.activeElement?.textContent).toBe('Choose');

    expect(press('ArrowDown').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(toggle);
    press('ArrowDown');
    expect(document.activeElement?.textContent).toBe('Choose');
    press('ArrowUp');
    expect(document.activeElement).toBe(toggle);
  });

  it('flips a toggle on Enter, and closes', () => {
    const { dropdown } = open();
    const toggle = dropdown.querySelector('input');
    toggle?.focus();

    expect(press('Enter').defaultPrevented).toBe(true);

    expect(toggle?.checked).toBe(true);
    expect(dropdown.hasAttribute('data-popover-open')).toBe(false);
  });

  it('leaves the up and down keys alone outside it', () => {
    open();
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();

    expect(press('ArrowDown').defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('tells the dropdown where it opened in the window', () => {
    const { dropdown } = open();
    Object.defineProperties(dropdown, { offsetLeft: { value: 18 }, offsetTop: { value: 369 } });

    dropdown.dispatchEvent(new Event('toggle'));

    expect(dropdown.style.getPropertyValue('--window-x')).toBe('18px');
    expect(dropdown.style.getPropertyValue('--window-y')).toBe('369px');
  });

  it('stays open as a toggle in it changes', () => {
    const { dropdown } = open();

    dropdown.querySelector('input')?.click();

    expect(dropdown.hasAttribute('data-popover-open')).toBe(true);
  });
});

@Component({
  imports: [DropdownMenu],
  template: `
    <app-dropdown-menu label="Run" [button]="false">
      <button type="button" (click)="chosen.push('Delete')">Delete</button>
      <button type="button" (click)="chosen.push('Play')">Play</button>
    </app-dropdown-menu>
  `,
})
class PressHost {
  readonly chosen: string[] = [];
  readonly menu = viewChild.required(DropdownMenu);
}

describe('DropdownMenu opened where something was pressed', () => {
  let host: PressHost;
  let dropdown: HTMLElement;

  beforeEach(async () => {
    installPopovers();
    const fixture = TestBed.createComponent(PressHost);
    await fixture.whenStable();
    host = fixture.componentInstance;
    const found = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.dropdown');
    if (found === null) {
      throw new Error('No dropdown');
    }
    dropdown = found;
  });

  afterEach(uninstallPopovers);

  it('has no button of its own', () => {
    expect(dropdown.parentElement?.querySelector('button.more')).toBeNull();
  });

  it('opens where it was asked to, ready for the keyboard', () => {
    const focus = vi.spyOn(HTMLButtonElement.prototype, 'focus');

    host.menu().openAt({ x: 40, y: 50 });

    expect(dropdown.hasAttribute('data-popover-open')).toBe(true);
    expect(dropdown.parentElement?.querySelector<HTMLElement>('.point')?.style.top).toBe('50px');
    expect(focus.mock.contexts.map((button) => (button as HTMLButtonElement).textContent)).toEqual([
      'Delete',
    ]);
  });

  it('opens where it was asked to in the window, even within a box that holds fixed elements', () => {
    const point = dropdown.parentElement?.querySelector<HTMLElement>('.point');
    if (point === undefined || point === null) {
      throw new Error('No point');
    }
    // Within a box at 300, 100 in the window, as a dialog card is.
    vi.spyOn(point, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(300 + parseFloat(point.style.left), 100 + parseFloat(point.style.top)),
    );

    host.menu().openAt({ x: 340, y: 150 });

    expect(point.getBoundingClientRect()).toMatchObject({ left: 340, top: 150 });
  });

  it('closes and does what a button says once chosen', () => {
    host.menu().openAt({ x: 40, y: 50 });

    dropdown.querySelectorAll('button')[1]?.click();

    expect(dropdown.hasAttribute('data-popover-open')).toBe(false);
    expect(host.chosen).toEqual(['Play']);
  });
});
