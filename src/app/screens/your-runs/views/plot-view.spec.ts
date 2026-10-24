import { TestBed } from '@angular/core/testing';
import type { Plot } from './plot';
import { PlotView } from './plot-view';

describe('PlotView', () => {
  const plot: Plot = {
    title: 'Log-odds',
    caption: 'The log-odds of a break at each place.',
    x: { min: 0, max: 10, labels: ['Place 1', 'Place 11'] },
    y: { min: -1, max: 1 },
    legend: [
      { mark: 'line', role: 'aggregate', label: 'Log-odds' },
      { mark: 'dots', role: 'break', label: 'A break' },
    ],
    layers: [
      {
        kind: 'line',
        points: [
          [0, 0],
          [10, 1],
        ],
        role: 'aggregate',
      },
      { kind: 'dots', points: [[10, 1]], role: 'break' },
    ],
  };

  function setUp() {
    const fixture = TestBed.createComponent(PlotView);
    fixture.componentRef.setInput('plot', plot);
    fixture.componentRef.setInput('step', '1/1');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const key = (label: string): HTMLButtonElement => {
      const found = Array.from(host.querySelectorAll('app-plot-legend button')).find(
        (button) => button.textContent.trim() === label,
      );
      if (!(found instanceof HTMLButtonElement)) {
        throw new Error(`No key ${label}`);
      }
      return found;
    };
    return {
      host,
      key,
      press: (label: string) => {
        key(label).click();
        fixture.detectChanges();
      },
    };
  }

  it('hides the marks of a key pressed, muting it, and shows them again when pressed again', () => {
    const { host, key, press } = setUp();
    expect(host.querySelectorAll('path.dots.break')).toHaveLength(1);

    press('A break');
    expect(host.querySelectorAll('path.dots.break')).toHaveLength(0);
    expect(host.querySelectorAll('path.aggregate')).toHaveLength(1);
    expect(key('A break').getAttribute('aria-pressed')).toBe('false');

    press('A break');
    expect(host.querySelectorAll('path.dots.break')).toHaveLength(1);
    expect(key('A break').getAttribute('aria-pressed')).toBe('true');
  });
});
