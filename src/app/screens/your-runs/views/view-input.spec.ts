import { format, niceStep, stepTicks } from './view-input';

describe('the axes of the views', () => {
  it('writes numbers as short as they read', () => {
    expect([format(3), format(-0.75), format(-0.4), format(1e-12), format(12.345)]).toEqual([
      '3',
      '-0.75',
      '-0.4',
      '0',
      '12',
    ]);
  });

  it('marks about five round values across a span', () => {
    expect([niceStep(13.4), niceStep(8), niceStep(1), niceStep(130)]).toEqual([2, 2, 0.2, 20]);
    expect(stepTicks(-4.1, 9.3, 2).map((tick) => tick.label)).toEqual([
      '-4',
      '-2',
      '0',
      '2',
      '4',
      '6',
      '8',
    ]);
  });
});
