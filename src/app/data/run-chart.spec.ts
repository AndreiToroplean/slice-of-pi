import { TestBed } from '@angular/core/testing';
import { RunChart } from './run-chart';
import { Series } from './run-charts';

describe('RunChart', () => {
  function setUp(
    values: Series,
    places: number,
    top: number,
    model: Partial<Record<'pace' | 'threshold' | 'trust' | 'breaks', unknown>> = {},
  ): SVGSVGElement {
    const fixture = TestBed.createComponent(RunChart);
    fixture.componentRef.setInput('values', values);
    for (const [name, value] of Object.entries(model)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.componentRef.setInput('places', places);
    fixture.componentRef.setInput('top', top);
    fixture.componentRef.setInput('label', 'Time per digit');
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
    if (svg === null) {
      throw new Error('No chart');
    }
    return svg;
  }

  it('is an image, labelled', () => {
    const svg = setUp([], 1, 1000);

    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Time per digit');
  });

  it('spans the places given, even past the end of its values', () => {
    const svg = setUp([undefined, 500], 10, 1000);

    expect(svg.getAttribute('viewBox')).toBe('0 0 9 100');
    expect(svg.querySelector('path')?.getAttribute('d')).toBe('M1 50h0');
  });

  it('draws a line at each whole second below the top', () => {
    const svg = setUp([], 10, 4000);

    expect(Array.from(svg.querySelectorAll('line'), (line) => line.getAttribute('y1'))).toEqual([
      '75',
      '50',
      '25',
    ]);
  });

  it('draws only the time per digit when given nothing else', () => {
    const svg = setUp([undefined, 500], 2, 1000);

    expect(svg.querySelectorAll('path')).toHaveLength(1);
    expect(svg.querySelector('.break')).toBeNull();
  });

  it('adds the pace, the pause threshold and the trust', () => {
    const svg = setUp([undefined, 500], 2, 1000, {
      pace: [undefined, 250],
      threshold: [undefined, 400],
      trust: [undefined, 1],
    });

    expect(svg.querySelector('.pace')?.getAttribute('d')).toBe('M1 75h0');
    expect(svg.querySelector('.threshold')?.getAttribute('d')).toBe('M1 60h0');
    expect(svg.querySelector('.trust')?.getAttribute('d')).toBe('M1 100L1 65L1 100Z');
  });

  it('draws each break between its place and the one before, the stronger the more trusted', () => {
    const svg = setUp([undefined, 500, 900], 3, 1000, {
      breaks: [
        { place: 2, strength: 1 },
        { place: 1, strength: 0 },
      ],
    });

    expect(
      Array.from(svg.querySelectorAll('.break'), (bar) => [
        bar.getAttribute('x1'),
        bar.getAttribute('stroke-opacity'),
      ]),
    ).toEqual([
      ['1.5', '1'],
      ['0.5', '0.25'],
    ]);
  });
});
