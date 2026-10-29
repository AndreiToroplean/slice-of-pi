import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { pressKey } from '../../testing/keys';
import { ButtonList } from './button-list';

@Component({
  imports: [ButtonList],
  template: `
    <app-button-list>
      <button type="button">A</button>
      <button type="button" class="primary">B</button>
      <button type="button" disabled>Disabled</button>
      <a href="/c">C</a>
    </app-button-list>
  `,
})
class Host {}

describe('ButtonList', () => {
  let host: HTMLElement;
  let buttons: HTMLElement[];

  beforeEach(async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
    buttons = Array.from(host.querySelectorAll('button:enabled, a'));
  });

  const stops = (): string[] =>
    buttons.filter((button) => button.tabIndex === 0).map((button) => button.textContent);
  const focused = (): string | undefined => document.activeElement?.textContent.trim();

  it('is one stop for Tab, on its primary button', () => {
    expect(stops()).toEqual(['B']);
  });

  it('moves with the up and down keys, Tab stopping where the keyboard last was', () => {
    buttons[1]?.focus();

    expect(pressKey('ArrowDown').defaultPrevented).toBe(true);

    expect(document.activeElement).toBe(buttons[2]);
    expect(stops()).toEqual(['C']);
  });

  it('moves past what is disabled, round from either end', () => {
    buttons[0]?.focus();

    pressKey('ArrowUp');
    expect(focused()).toBe('C');
    pressKey('ArrowDown');
    expect(focused()).toBe('A');
    pressKey('ArrowDown');
    expect(focused()).toBe('B');
  });

  it('moves onto the first going down, or the last going up, when none has the focus', () => {
    const list = host.querySelector('app-button-list');

    pressKey('ArrowDown', list);
    expect(focused()).toBe('A');

    (document.activeElement as HTMLElement).blur();
    pressKey('ArrowUp', list);
    expect(focused()).toBe('C');
  });
});
