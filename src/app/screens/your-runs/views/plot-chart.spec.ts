import { TestBed } from '@angular/core/testing';
import { Plot } from './plot';
import { PlotChart } from './plot-chart';

describe('PlotChart', () => {
  function render(plot: Plot, marker?: number) {
    const fixture = TestBed.createComponent(PlotChart);
    fixture.componentRef.setInput('plot', plot);
    fixture.componentRef.setInput('marker', marker);
    fixture.detectChanges();
    return fixture;
  }

  function draw(plot: Plot, marker?: number): SVGElement {
    return (render(plot, marker).nativeElement as HTMLElement).querySelector('svg') as SVGElement;
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

  it('draws an area between two lines, broken where either has no point', () => {
    const svg = draw({
      ...plot,
      layers: [
        {
          kind: 'area',
          upper: [[0, 1], [5, 1], undefined, [10, 0.5]],
          lower: [
            [0, -1],
            [5, 0],
            [8, 0],
            [10, 0],
          ],
          role: 'faint',
        },
      ],
    });

    expect(svg.querySelector('path.area')?.getAttribute('d')).toBe(
      'M0 0L500 0L500 50L0 100ZM1000 25L1000 50Z',
    );
  });

  it('draws bars from their base, else from the bottom', () => {
    const svg = draw({
      ...plot,
      layers: [
        {
          kind: 'bars',
          bars: [
            { from: 0, to: 5, height: 1, base: 0 },
            { from: 5, to: 10, height: -0.5, base: 0.5 },
            { from: 0, to: 5, height: 0 },
          ],
          role: 'run',
        },
      ],
    });

    expect(
      [...svg.querySelectorAll('rect')].map((rect) => [
        rect.getAttribute('y'),
        rect.getAttribute('height'),
      ]),
    ).toEqual([
      ['0', '50'],
      ['25', '50'],
      ['50', '50'],
    ]);
  });

  it('marks values on its y-axis, within its range', () => {
    const fixture = render({
      ...plot,
      y: {
        min: -1,
        max: 1,
        ticks: [
          { value: 0.5, label: '½' },
          { value: 3, label: 'out' },
        ],
      },
    });
    const host = fixture.nativeElement as HTMLElement;

    expect([...host.querySelectorAll('.label')].map((label) => label.textContent.trim())).toEqual([
      '½',
    ]);
    expect(host.querySelector('path.tick')?.getAttribute('d')).toBe('M0 25H1000');
  });

  it('marks where it is told to, and tells where it is tapped', () => {
    const fixture = render(plot, 2.5);
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
    const picked: number[] = [];
    fixture.componentInstance.picked.subscribe((x) => picked.push(x));
    svg.getBoundingClientRect = () => new DOMRect(10, 0, 200, 50);
    svg.dispatchEvent(new MouseEvent('pointerup', { clientX: 60 }));

    expect(svg.querySelector('path.marker')?.getAttribute('d')).toBe('M250 0V100');
    expect(picked).toEqual([2.5]);
    expect(draw(plot, 11).querySelector('path.marker')).toBeNull();
  });

  it('draws the window of its x-axis zoomed into, leaving out what is out of it', () => {
    const fixture = render(plot, 2.5);
    fixture.componentRef.setInput('window', { min: 0, max: 5 });
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;

    expect(svg.querySelector('path.dots.break')?.getAttribute('d')).toBe('M1000 50h0M2000 0h0');
    expect(svg.querySelector('path.marker')?.getAttribute('d')).toBe('M500 0V100');
    expect(svg.classList.contains('zoomed')).toBe(true);
  });
});
