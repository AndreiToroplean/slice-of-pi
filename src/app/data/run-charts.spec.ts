import { addDigit, newRun, Run } from '../runs/run';
import { average, CHART_HEIGHT, chartPath, chartTop, digitTimes } from './run-charts';

describe('run charts', () => {
  function runAt(times: number[]): Run {
    return times.reduce((run, time) => addDigit(run, '1', time), newRun('run', 0));
  }

  describe('digitTimes', () => {
    it('gives the time since the digit before, with none for the first digit', () => {
      expect(digitTimes(runAt([0, 300, 450, 1450]))).toEqual([undefined, 300, 150, 1000]);
    });

    it('gives nothing for a run without digits', () => {
      expect(digitTimes(newRun('run', 0))).toEqual([]);
    });
  });

  describe('average', () => {
    it('averages each place over the series that reach it', () => {
      expect(
        average([
          [undefined, 300, 200],
          [undefined, 100],
        ]),
      ).toEqual([undefined, 200, 200]);
    });

    it('gives nothing without series', () => {
      expect(average([])).toEqual([]);
    });
  });

  describe('chartTop', () => {
    it('is at least a second', () => {
      expect(chartTop([])).toBe(1000);
      expect(chartTop([[undefined, 200, 300]])).toBe(1000);
    });

    it('fits nearly every digit, in whole seconds, cutting off the longest pauses', () => {
      const times = Array.from({ length: 99 }, () => 1500);
      expect(chartTop([[undefined, ...times, 60_000]])).toBe(2000);
    });
  });

  describe('chartPath', () => {
    it('draws one unit per place, with the top of the chart at the top time', () => {
      expect(chartPath([undefined, 500, 1000, 0], 1000)).toBe(
        `M1 ${String(CHART_HEIGHT / 2)}h0L2 0L3 ${String(CHART_HEIGHT)}`,
      );
    });

    it('cuts off values above the top', () => {
      expect(chartPath([5000], 1000)).toBe('M0 0h0');
    });

    it('breaks the line where a place has no value', () => {
      expect(chartPath([0, undefined, 0], 1000)).toBe('M0 100h0M2 100h0');
    });
  });
});
