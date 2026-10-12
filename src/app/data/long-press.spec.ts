import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LONG_PRESS_MS, LONG_PRESS_SLOP, LongPress } from './long-press';

@Component({
  imports: [LongPress],
  template: `<div (appLongPress)="points.push($event)"></div>`,
})
class Host {
  points: { x: number; y: number }[] = [];
  get presses(): number {
    return this.points.length;
  }
}

describe('LongPress', () => {
  let host: Host;
  let element: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    host = fixture.componentInstance;
    element = (fixture.nativeElement as HTMLElement).querySelector('div') as HTMLElement;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function pointer(type: string, x = 0, button = 0): void {
    element.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: 0, button }));
  }

  it('tells a press held still long enough, and where it started', () => {
    pointer('pointerdown', 30);
    vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    expect(host.presses).toBe(0);

    vi.advanceTimersByTime(1);
    expect(host.points).toEqual([{ x: 30, y: 0 }]);
  });

  it('gives up a press let go of too soon', () => {
    pointer('pointerdown');
    vi.advanceTimersByTime(LONG_PRESS_MS / 2);
    pointer('pointerup');
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(host.presses).toBe(0);
  });

  it('gives up a press that moves, as when scrolling, but not one that wobbles', () => {
    pointer('pointerdown');
    pointer('pointermove', LONG_PRESS_SLOP);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(host.presses).toBe(1);

    pointer('pointerup');
    pointer('pointerdown');
    pointer('pointermove', LONG_PRESS_SLOP + 1);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(host.presses).toBe(1);

    pointer('pointerdown');
    pointer('pointercancel');
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(host.presses).toBe(1);
  });

  it('tells a request for the context menu, and where, once per press', () => {
    element.dispatchEvent(new MouseEvent('contextmenu', { clientX: 5, clientY: 7 }));
    expect(host.points).toEqual([{ x: 5, y: 7 }]);

    pointer('pointerdown');
    vi.advanceTimersByTime(LONG_PRESS_MS);
    element.dispatchEvent(new MouseEvent('contextmenu'));
    expect(host.presses).toBe(2);
    pointer('pointerup');

    pointer('pointerdown', 0, 2);
    element.dispatchEvent(new MouseEvent('contextmenu'));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(host.presses).toBe(3);
  });
});
