/**
 * The statistics the break models are built from: rolling medians, a mixture of two normal distributions fitted by
 * weighted EM, isotonic regression and the Beta distribution. Nothing here knows about runs or π.
 */

/** A mixture of two normal distributions: component 0 is normal intervals, component 1 breaks. */
export interface Mixture {
  readonly weight: readonly [number, number];
  readonly mean: readonly [number, number];
  readonly sd: readonly [number, number];
}

/** Weighted EM stops after this many rounds by default, or once the log-likelihood gains less than {@link TOLERANCE}. */
const MAXIMUM_ROUNDS = 200;
const TOLERANCE = 1e-8;
/** The smallest spread a component can have, in log-interval: 0.1%. */
const SMALLEST_SD = 1e-3;

/** A causal rolling median: the value at p is the median of the values from p - window + 1 to p. */
export function trailingMedian(values: Float64Array, window: number): Float64Array {
  return values.map((_, p) => median(values.slice(Math.max(0, p - window + 1), p + 1)));
}

/**
 * A centered rolling median of `size` values, the values mirrored past both ends (d c b a | a b c d | d c b a). For an
 * even size, the window reaches one value further back, and takes the higher of the two middle values.
 */
export function centeredMedian(values: Float64Array, size: number): Float64Array {
  const length = values.length;
  const back = Math.floor(size / 2);
  const window = new Float64Array(size);
  return values.map((_, p) => {
    for (let o = 0; o < size; o++) {
      const q = p - back + o;
      window[o] = values[q < 0 ? -q - 1 : q >= length ? 2 * length - q - 1 : q] ?? 0;
    }
    return window.sort()[back] ?? 0;
  });
}

/**
 * How many spreads of their bell curve the neighbors of a value reach on each side: further ones would weigh under
 * 1.2%.
 */
const NEIGHBORS_CUTOFF = 3;

/**
 * The weighted mean and standard deviation (spread) of the neighbors of the value at index i, within a centered window
 * of `window` values, from index `first` on, and how many there are. Each weighs by a bell curve of its distance to i,
 * and i itself is left out, so that a value never raises its own bar.
 */
export function neighborsOf(
  values: ArrayLike<number>,
  i: number,
  window: number,
  first = 0,
): { readonly mean: number; readonly spread: number; readonly count: number } {
  const reach = Math.floor(window / 2);
  const bell = reach / NEIGHBORS_CUTOFF;
  let weights = 0;
  let sum = 0;
  let sumOfSquares = 0;
  let count = 0;
  for (let j = Math.max(first, i - reach); j <= Math.min(values.length - 1, i + reach); j++) {
    const value = values[j];
    if (j === i || value === undefined) {
      continue;
    }
    const weight = Math.exp(-((j - i) ** 2) / (2 * bell ** 2));
    weights += weight;
    sum += weight * value;
    sumOfSquares += weight * value ** 2;
    count++;
  }
  if (count === 0) {
    return { mean: 0, spread: 0, count };
  }
  const mean = sum / weights;
  return { mean, spread: Math.sqrt(Math.max(0, sumOfSquares / weights - mean ** 2)), count };
}

/** The median of the values, which it sorts in place. */
export function median(values: Float64Array): number {
  const sorted = values.sort();
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** How dense each component of the mixture is at a residual, weighted by its share: normal intervals, then breaks. */
export function mixtureDensity(mixture: Mixture, x: number): readonly [number, number] {
  return [
    mixture.weight[0] * normalDensity(x, mixture.mean[0], mixture.sd[0]),
    mixture.weight[1] * normalDensity(x, mixture.mean[1], mixture.sd[1]),
  ];
}

/**
 * The residual over which an interval is taken for a break, as the break models decide with this threshold: where P(break)
 * first reaches it above the normal mean. `undefined` if it never does within a few spreads of the breaks.
 */
export function breakBoundary(mixture: Mixture, threshold: number): number | undefined {
  const probability = (x: number): number => {
    const [normal, pause] = mixtureDensity(mixture, x);
    return pause / (normal + pause || 1);
  };
  let low = mixture.mean[0];
  let high = Math.max(mixture.mean[1], low) + 4 * mixture.sd[1];
  if (probability(low) >= threshold) {
    return low;
  }
  if (probability(high) < threshold) {
    return undefined;
  }
  for (let round = 0; round < 50; round++) {
    const middle = (low + high) / 2;
    if (probability(middle) < threshold) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return high;
}

function normalDensity(x: number, mean: number, sd: number): number {
  return Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
}

/**
 * Fits a mixture of two normal distributions to the residuals, each counting with its weight, by weighted EM. Without
 * `init`, it starts from the prior mixture, if any, else from a normal component at the median and a break component 3
 * spreads above it (taking the median absolute deviation as the spread).
 *
 * With a prior of some strength, the fit is a MAP estimate (maximum a posteriori): the prior mixture counts as that many
 * intervals of data, each component's share of them drawn from it. With few intervals, the fit stays close to the prior;
 * as they come, it moves smoothly to the intervals' own mixture.
 */
export function fitMixture(
  residuals: Float64Array,
  weights: Float64Array,
  init?: Mixture,
  prior?: { readonly mixture: Mixture; readonly strength: number },
): { mixture: Mixture; posterior: Float64Array } {
  const start = init ?? (prior !== undefined && prior.strength > 0 ? prior.mixture : undefined);
  // The prior's pseudo-intervals for each component.
  const pseudo = [0, 1].map((j) => (prior?.strength ?? 0) * (prior?.mixture.weight[j] ?? 0));
  const [normalPseudo = 0, pausePseudo = 0] = pseudo;
  const priorMean = prior?.mixture.mean ?? [0, 0];
  const priorSd = prior?.mixture.sd ?? [0, 0];
  let share: [number, number];
  let mean: [number, number];
  let sd: [number, number];
  if (start !== undefined) {
    share = [...start.weight];
    mean = [...start.mean];
    sd = [...start.sd];
  } else {
    const middle = median(residuals.slice());
    const spread = 1.4826 * median(residuals.map((r) => Math.abs(r - middle))) + 1e-6;
    share = [0.9, 0.1];
    mean = [middle, middle + 3 * spread];
    sd = [spread, 2 * spread];
  }
  const count = residuals.length;
  const posterior = new Float64Array(count);
  const expect = (): number => {
    let likelihood = 0;
    for (let i = 0; i < count; i++) {
      const r = residuals[i] ?? 0;
      const normal = share[0] * normalDensity(r, mean[0], sd[0]);
      const pause = share[1] * normalDensity(r, mean[1], sd[1]);
      // As tiny as can be, so that no point is impossible under either component.
      const both = normal + pause + 2e-300;
      posterior[i] = (pause + 1e-300) / both;
      likelihood += (weights[i] ?? 0) * Math.log(both);
    }
    return likelihood;
  };
  let previous = -Infinity;
  for (let round = 0; round < MAXIMUM_ROUNDS; round++) {
    const likelihood = expect();
    const before = [...share, ...mean, ...sd];
    let pauses = pausePseudo;
    let all = normalPseudo + pausePseudo;
    let pauseSum = pausePseudo * priorMean[1];
    let normalSum = normalPseudo * priorMean[0];
    for (let i = 0; i < count; i++) {
      const w = weights[i] ?? 0;
      const p = posterior[i] ?? 0;
      const r = residuals[i] ?? 0;
      all += w;
      pauses += w * p;
      pauseSum += w * p * r;
      normalSum += w * (1 - p) * r;
    }
    const normals = all - pauses;
    if (!(normals > 0 && pauses > 0)) {
      // A component lost every point: there's only one kind of interval.
      break;
    }
    mean = [normalSum / normals, pauseSum / pauses];
    // The pseudo-intervals spread around the prior's means as its spreads say.
    let normalSquares = normalPseudo * (priorSd[0] ** 2 + (mean[0] - priorMean[0]) ** 2);
    let pauseSquares = pausePseudo * (priorSd[1] ** 2 + (mean[1] - priorMean[1]) ** 2);
    for (let i = 0; i < count; i++) {
      const w = weights[i] ?? 0;
      const p = posterior[i] ?? 0;
      const r = residuals[i] ?? 0;
      normalSquares += w * (1 - p) * (r - mean[0]) ** 2;
      pauseSquares += w * p * (r - mean[1]) ** 2;
    }
    share = [normals / all, pauses / all];
    sd = [
      Math.max(Math.sqrt(normalSquares / normals), SMALLEST_SD),
      Math.max(Math.sqrt(pauseSquares / pauses), SMALLEST_SD),
    ];
    // With a prior, the fit maximizes more than the likelihood, so it stops once the mixture no longer moves.
    const moved = Math.max(
      ...[...share, ...mean, ...sd].map((value, k) => Math.abs(value - (before[k] ?? 0))),
    );
    if (normalPseudo + pausePseudo > 0 ? moved < TOLERANCE : likelihood - previous < TOLERANCE) {
      break;
    }
    previous = likelihood;
  }
  // Component 0 stays the normal one, 1 the break.
  if (mean[1] < mean[0]) {
    share = [share[1], share[0]];
    mean = [mean[1], mean[0]];
    sd = [sd[1], sd[0]];
  }
  expect();
  return { mixture: { weight: share, mean, sd }, posterior };
}

/** The least-squares non-increasing fit of the values, by pooling adjacent violators. */
export function isotonicDecreasing(values: readonly number[]): number[] {
  const means: number[] = [];
  const sizes: number[] = [];
  for (const value of values) {
    means.push(value);
    sizes.push(1);
    while (means.length > 1 && (means.at(-2) ?? 0) < (means.at(-1) ?? 0)) {
      const later = means.pop() ?? 0;
      const laterSize = sizes.pop() ?? 0;
      const size = sizes.at(-1) ?? 0;
      means[means.length - 1] =
        ((means.at(-1) ?? 0) * size + later * laterSize) / (size + laterSize);
      sizes[sizes.length - 1] = size + laterSize;
    }
  }
  return means.flatMap((mean, k) => Array<number>(sizes[k] ?? 0).fill(mean));
}

/** The cumulative distribution function of the Beta(a, b) distribution at x: the regularized incomplete beta. */
export function betaCdf(x: number, a: number, b: number): number {
  if (x <= 0) {
    return 0;
  }
  if (x >= 1) {
    return 1;
  }
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (front * betaFraction(x, a, b)) / a
    : 1 - (front * betaFraction(1 - x, b, a)) / b;
}

/** The continued fraction of the incomplete beta function, by the modified Lentz method. */
function betaFraction(x: number, a: number, b: number): number {
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  d = 1 / (Math.abs(d) < tiny ? tiny : d);
  let result = d;
  for (let m = 1; m <= 300; m++) {
    for (const numerator of [
      (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m)),
      -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1)),
    ]) {
      d = 1 + numerator * d;
      d = 1 / (Math.abs(d) < tiny ? tiny : d);
      c = 1 + numerator / c;
      c = Math.abs(c) < tiny ? tiny : c;
      result *= c * d;
    }
    if (Math.abs(c * d - 1) < 1e-14) {
      break;
    }
  }
  return result;
}

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** The log of the gamma function, for positive numbers, by the Lanczos approximation. */
function logGamma(x: number): number {
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const z = x - 1;
  let sum = LANCZOS[0] ?? 1;
  for (let k = 1; k < LANCZOS.length; k++) {
    sum += (LANCZOS[k] ?? 0) / (z + k);
  }
  const t = z + LANCZOS.length - 1.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}
