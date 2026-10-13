import { TestBed } from '@angular/core/testing';
import { Plot } from './model-views';
import { PlotChart } from './plot-chart';

describe('PlotChart', () => {
  function draw(plot: Plot): SVGElement {
    const fixture = TestBed.createComponent(PlotChart);
    fixture.componentRef.setInput('plot', plot);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
  }

  const plot: Plot = {
    title: 'Residuals',
    caption: 'Each interval over its baseline.',
    x: { min: 0, max: 10, labels: ['Place 1', 'Place 11'] },
    y: { min: -1, max: 1 },
    layers: [
      { kind: 'band', from: -0.5, to: 0.5, role: 'faint' },
      {
        kind: 'dots',
        points: [
          [5, 0],
          [10, 2],
        ],
        role: 'break',
      },
      { kind: 'vline', x: 5, role: 'break' },
    ],
  };

  it('draws each mark where it goes, cutting off what is out of range', () => {
    const svg = draw(plot);

    const band = svg.querySelector('rect');
    expect([band?.getAttribute('y'), band?.getAttribute('height')]).toEqual(['25', '50']);
    expect(svg.querySelector('path.dots.break')?.getAttribute('d')).toBe('M500 50h0M1000 0h0');
    expect(svg.querySelector('path.break:not(.dots)')?.getAttribute('d')).toBe('M500 0V100');
  });

  it('says what it shows', () => {
    expect(draw(plot).getAttribute('aria-label')).toBe(
      'Residuals: Each interval over its baseline.',
    );
  });
});
