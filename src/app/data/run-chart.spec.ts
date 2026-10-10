import { TestBed } from '@angular/core/testing';
import { RunChart } from './run-chart';
import { Series } from './run-charts';

describe('RunChart', () => {
  function setUp(values: Series, places: number, top: number): SVGSVGElement {
    const fixture = TestBed.createComponent(RunChart);
    fixture.componentRef.setInput('values', values);
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
});
