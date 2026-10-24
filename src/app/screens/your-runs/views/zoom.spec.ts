import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Range } from './plot';
import { Zoom } from './zoom';

@Component({
  imports: [Zoom],
  template: `
    <div class="track" style="overflow-x: auto">
      <div [appZoom]="whole" [(zoom)]="zoom" (pointerup)="taps = taps + 1"></div>
    </div>
  `,
})
class Host {
  readonly whole: Range = { min: 0, max: 100 };
  readonly zoom = signal<Range | undefined>(undefined);
  taps = 0;
}

describe('Zoom', () => {
  function setUp() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const track = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.track');
    const chart = track?.querySelector('div');
    if (track === null || chart === null || chart === undefined) {
      throw new Error('No chart');
    }
    // Wider inside than out, so that it scrolls sideways, as a carousel does.
    Object.defineProperty(track, 'scrollWidth', { value: 600 });
    Object.defineProperty(track, 'clientWidth', { value: 200 });
    // 200 pixels wide, from 0: a pixel is half a unit, all zoomed out.
    chart.getBoundingClientRect = () => new DOMRect(0, 0, 200, 50);
    const host = fixture.componentInstance;
    return {
      host,
      track,
      wheel: (clientX: number, deltaY: number, deltaX = 0, shiftKey = false, deltaMode = 0) => {
        chart.dispatchEvent(
          new WheelEvent('wheel', {
            clientX,
            deltaY,
            deltaX,
            shiftKey,
            deltaMode,
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      touch: (type: string, ...xs: number[]) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'touches', { value: xs.map((clientX) => ({ clientX })) });
        chart.dispatchEvent(event);
      },
      tap: () => {
        chart.dispatchEvent(new Event('pointerup', { bubbles: true }));
      },
    };
  }

  /** The wheel's scroll that halves the window shown. */
  const HALVING = Math.log(0.5) / 0.002;

  it('zooms in with the mouse wheel around the pointer, along x only', () => {
    const { host, wheel } = setUp();
    wheel(50, HALVING);

    // What was under the pointer, a quarter across at 25, stays there.
    expect(host.zoom()?.min).toBeCloseTo(12.5, 9);
    expect(host.zoom()?.max).toBeCloseTo(62.5, 9);
  });

  it('shows all of the axis again once zoomed out as far as it goes, and never further in than a 40th of it', () => {
    const { host, wheel } = setUp();
    wheel(100, HALVING);
    wheel(100, -2 * HALVING);
    expect(host.zoom()).toBeUndefined();

    for (let i = 0; i < 10; i++) {
      wheel(100, HALVING);
    }
    const zoom = host.zoom();
    expect((zoom?.max ?? 0) - (zoom?.min ?? 0)).toBeCloseTo(2.5, 9);
  });

  it('pans with a sideways scroll, once zoomed in, a unit of x to a line of the wheel, within the axis', () => {
    const { host, wheel } = setUp();
    wheel(0, 0, 100);
    expect(host.zoom()).toBeUndefined();

    wheel(0, HALVING);
    // A notch, 100 pixels: 3 lines.
    wheel(0, 0, 100);
    expect(host.zoom()?.min).toBeCloseTo(3, 9);
    wheel(0, 0, -1, false, WheelEvent.DOM_DELTA_LINE);
    expect(host.zoom()?.min).toBeCloseTo(2, 9);
    wheel(0, 0, 10_000);
    expect(host.zoom()).toEqual({ min: 50, max: 100 });
  });

  it('pans with the wheel while Shift is held', () => {
    const { host, wheel } = setUp();
    wheel(0, HALVING);
    wheel(0, 100, 0, true);

    expect(host.zoom()?.min).toBeCloseTo(3, 9);
    expect(host.zoom()?.max).toBeCloseTo(53, 9);
  });

  it('zooms as much for a notch of the wheel whether it counts in lines or pixels', () => {
    const lines = setUp();
    lines.wheel(0, -3, 0, false, WheelEvent.DOM_DELTA_LINE);
    const pixels = setUp();
    pixels.wheel(0, -100);

    expect(lines.host.zoom()?.max).toBeLessThan(100);
    expect(lines.host.zoom()?.max).toBeCloseTo(pixels.host.zoom()?.max ?? NaN, 9);
  });

  it('zooms in with a pinch around the fingers, and lets the tap ending it go', () => {
    const { host, touch, tap } = setUp();
    touch('touchstart', 80, 120);
    touch('touchmove', 60, 140);
    touch('touchend', 60);
    tap();

    expect(host.zoom()?.min).toBeCloseTo(25, 9);
    expect(host.zoom()?.max).toBeCloseTo(75, 9);
    expect(host.taps).toBe(0);
  });

  it('pans with two fingers moving together, what was under them staying there', () => {
    const { host, touch } = setUp();
    touch('touchstart', 80, 120);
    touch('touchmove', 60, 140);
    // 40 pixels to the right: a fifth of the 50 units shown.
    touch('touchmove', 100, 180);

    expect(host.zoom()?.min).toBeCloseTo(15, 9);
    expect(host.zoom()?.max).toBeCloseTo(65, 9);
  });

  it('holds still what scrolls around the chart during a pinch, where it was as the first finger landed', () => {
    const { track, touch } = setUp();
    touch('touchstart', 80);
    // The browser starts scrolling with the first finger before the second lands.
    track.scrollLeft = 30;
    touch('touchstart', 80, 120);
    expect(track.style.overflowX).toBe('hidden');
    expect(track.scrollLeft).toBe(0);

    track.scrollLeft = 50;
    touch('touchend', 80);
    expect(track.style.overflowX).toBe('');
    expect(track.scrollLeft).toBe(0);
  });

  it('lets a tap through without a pinch', () => {
    const { host, tap } = setUp();
    tap();

    expect(host.taps).toBe(1);
  });
});
