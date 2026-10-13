import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { installPopovers, uninstallPopovers } from '../../testing/fake-popovers';
import { OverflowMenu } from './overflow-menu';

@Component({
  imports: [OverflowMenu],
  template: `
    <app-overflow-menu>
      <button type="button">Choose</button>
      <label class="toggle"><input type="checkbox" /> Toggle</label>
    </app-overflow-menu>
  `,
})
class Host {}

describe('OverflowMenu', () => {
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

    dropdown.querySelector('button')?.click();

    expect(dropdown.hasAttribute('data-popover-open')).toBe(false);
  });

  it('stays open as a toggle in it changes', () => {
    const { dropdown } = open();

    dropdown.querySelector('input')?.click();

    expect(dropdown.hasAttribute('data-popover-open')).toBe(true);
  });
});
