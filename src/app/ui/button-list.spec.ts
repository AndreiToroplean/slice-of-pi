import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ButtonList } from './button-list';

@Component({
  imports: [ButtonList],
  template: `
    <app-button-list>
      <button type="button">A</button>
      <button type="button" class="primary">B</button>
      <button type="button">C</button>
    </app-button-list>
  `,
})
class Host {}

describe('ButtonList', () => {
  let buttons: HTMLButtonElement[];

  beforeEach(async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  });

  const stops = (): string[] =>
    buttons.filter((button) => button.tabIndex === 0).map((button) => button.textContent);

  it('is one stop for Tab, on its primary button', () => {
    expect(stops()).toEqual(['B']);
  });

  it('moves with the up and down keys, Tab stopping where the keyboard last was', () => {
    buttons[1]?.focus();

    buttons[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(document.activeElement).toBe(buttons[2]);
    expect(stops()).toEqual(['C']);
  });
});
