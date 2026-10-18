import { MERCURY_DEFAULTS } from './mercury';
import {
  betaCdf,
  breakBoundary,
  centeredMedian,
  fitMixture,
  isotonicDecreasing,
  mixtureDensity,
  neighborsOf,
  trailingMedian,
} from './statistics';
import { priorMixture } from './steps';

describe('neighbors', () => {
  it('weighs the neighbors of a value around it, leaving it out', () => {
    expect(neighborsOf([2, 2, 100, 2, 2], 2, 5)).toEqual({ mean: 2, spread: 0, count: 4 });
    expect(neighborsOf([1, 3, 100, 3, 1], 2, 5).spread).toBeGreaterThan(0);
  });

  it('weighs nearer neighbors more', () => {
    expect(neighborsOf([0, 10, 0, 0, 0], 2, 5).mean).toBeGreaterThan(
      neighborsOf([10, 0, 0, 0, 0], 2, 5).mean,
    );
  });

  it('takes no value before the first one asked for', () => {
    expect(neighborsOf([100, 2, 2, 2], 2, 5, 1)).toEqual({ mean: 2, spread: 0, count: 2 });
    expect(neighborsOf([5], 0, 5).count).toBe(0);
  });
});

describe('medians', () => {
  it('takes a trailing median of the values so far only', () => {
    expect(Array.from(trailingMedian(Float64Array.from([1, 5, 2, 8, 3]), 3))).toEqual([
      1, 3, 2, 5, 3,
    ]);
  });

  it('takes a centered median, mirroring the values past both ends', () => {
    expect(Array.from(centeredMedian(Float64Array.from([1, 9, 2, 3, 7]), 3))).toEqual([
      1, 2, 3, 3, 7,
    ]);
  });

  it('reaches one value further back for an even size, taking the higher middle value', () => {
    expect(Array.from(centeredMedian(Float64Array.from([1, 9, 2, 3]), 2))).toEqual([1, 9, 9, 3]);
  });
});

describe('the Beta distribution', () => {
  it('matches the closed forms', () => {
    expect(betaCdf(0.5, 1, 3.7)).toBeCloseTo(1 - 0.5 ** 3.7, 10);
    expect(betaCdf(0.5, 2.5, 1)).toBeCloseTo(0.5 ** 2.5, 10);
    expect(betaCdf(0.5, 7.3, 7.3)).toBeCloseTo(0.5, 10);
    expect(betaCdf(0.3, 2, 2)).toBeCloseTo(3 * 0.3 ** 2 - 2 * 0.3 ** 3, 10);
  });

  it('is 0 and 1 at the ends', () => {
    expect(betaCdf(0, 2, 3)).toBe(0);
    expect(betaCdf(1, 2, 3)).toBe(1);
  });
});

describe('isotonic regression', () => {
  it('keeps values that never go up', () => {
    expect(isotonicDecreasing([3, 2, 2, 1])).toEqual([3, 2, 2, 1]);
  });

  it('pools the values that go up with those before them', () => {
    expect(isotonicDecreasing([1, 3, 2, 0, 1])).toEqual([2, 2, 2, 0.5, 0.5]);
  });
});

describe('the mixture', () => {
  it('separates normal intervals from breaks, component 0 being the normal one', () => {
    const residuals = Float64Array.from([-0.1, 0, 0.1, -0.05, 0.05, 1.2, 1.3, 0, 0.02, -0.02]);
    const { mixture, posterior } = fitMixture(residuals, new Float64Array(10).fill(1));

    expect(mixture.mean[0]).toBeCloseTo(0, 1);
    expect(mixture.mean[1]).toBeCloseTo(1.25, 2);
    expect(mixture.weight[1]).toBeCloseTo(0.2, 2);
    expect(Array.from(posterior, (p) => Math.round(p))).toEqual([0, 0, 0, 0, 0, 1, 1, 0, 0, 0]);
  });

  it('counts each residual with its weight', () => {
    const residuals = Float64Array.from([-0.1, 0, 0.1, -0.05, 0.05, 1.2, 1.3, 0, 0.02, -0.02]);
    const weights = Float64Array.from([1, 1, 1, 1, 1, 0.5, 0.5, 1, 1, 1]);

    expect(fitMixture(residuals, weights).mixture.weight[1]).toBeCloseTo(1 / 9, 2);
  });

  it('converges to the same mixture from the last one', () => {
    const residuals = Float64Array.from([-0.1, 0, 0.1, -0.05, 0.05, 1.2, 1.3, 0, 0.02, -0.02]);
    const weights = new Float64Array(10).fill(1);
    const cold = fitMixture(residuals, weights).mixture;
    const warm = fitMixture(residuals, weights, cold).mixture;

    expect(warm.mean[1]).toBeCloseTo(cold.mean[1], 6);
    expect(warm.sd[0]).toBeCloseTo(cold.sd[0], 6);
  });
});

describe('the break boundary', () => {
  const mixture = priorMixture(MERCURY_DEFAULTS);

  it('is where P(break) reaches the threshold, higher for a higher one', () => {
    const half = breakBoundary(mixture, 0.5) ?? 0;
    const [normal, pause] = mixtureDensity(mixture, half);

    expect(pause / (normal + pause)).toBeCloseTo(0.5, 6);
    expect(breakBoundary(mixture, 0.9) ?? 0).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(mixture.mean[0]);
  });

  it('is the normal mean when anything slower is already likely a break', () => {
    expect(breakBoundary(mixture, 0.0001)).toBe(mixture.mean[0]);
  });
});
