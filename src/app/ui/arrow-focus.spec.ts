import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ArrowFocus } from './arrow-focus';

@Component({
  imports: [ArrowFocus],
  template: `
    <div appArrowFocus>
      <button type="button">A</button>
      <button type="button" disabled>Off</button>
      <a href="/b">B</a>
      <button type="button">C</button>
      <div appArrowFocus><button type="button">Inner</button></div>
    </div>
  `,
})
class Host {}

describe('ArrowFocus', () => {
  let host: HTMLElement;

  beforeEach(async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
  });

  const focused = (): string | undefined => document.activeElement?.textContent.trim();

  function press(key: string, on: Element | null = document.activeElement): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    on?.dispatchEvent(event);
    return event;
  }

  it('moves onto the first going down, or the last going up, when none has the focus', () => {
    const group = host.querySelector('[appArrowFocus]');

    expect(press('ArrowDown', group).defaultPrevented).toBe(true);
    expect(focused()).toBe('A');

    (document.activeElement as HTMLElement).blur();
    press('ArrowUp', group);
    expect(focused()).toBe('Inner');
  });

  it('moves down and up past what is disabled, round from either end', () => {
    host.querySelector('button')?.focus();

    press('ArrowDown');
    expect(focused()).toBe('B');
    press('ArrowUp');
    expect(focused()).toBe('A');
    press('ArrowUp');
    expect(focused()).toBe('Inner');
  });

  it('leaves the keys to a group within', () => {
    host.querySelector<HTMLElement>('[appArrowFocus] [appArrowFocus] button')?.focus();

    press('ArrowDown');

    expect(focused()).toBe('Inner');
  });
});
