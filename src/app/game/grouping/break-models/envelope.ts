import type { Hyperparameter, Settings, Values } from './break-model';

/**
 * The group-size envelope, Mars's (`mars.ts`): a factor from 0 to 1 for each size of group, which weighs how likely a
 * grouping is, so that groups too small or too big are less likely, down to never at 0. It isn't a probability: a
 * grouping's likelihood is multiplied by the factor of each of its groups' sizes, so an envelope of 1 at every size
 * changes nothing.
 *
 * Without it, each place is a break or not on its own: where its log-odds of a break are over the threshold. That's the
 * grouping with the highest score, the sum over its breaks of how far their log-odds are over the threshold. The
 * envelope adds the log of its factor for each group to that score, so the breaks are no longer chosen one at a time:
 * the grouping with the highest score is found over all the places at once (by dynamic programming, as for a
 * semi-Markov chain), so that cutting a group short never leaves the next one too long to cut well.
 *
 * What the envelope does at a place is then evidence like any other, in log-odds: the best score with a break there
 * less the best without one, less the place's own log-odds over the threshold. Added to those, it puts the place over
 * the threshold just where the best grouping breaks, so the rest of the model reads it as it reads the evidence of the
 * runs. It's infinite where the envelope rules a break in or out whatever the runs say.
 *
 * The strength raises every factor to its power, so that the envelope can weigh as much as the evidence of many runs:
 * 1 leaves the factors as they are; whatever it is, a factor of 1 leaves a size be and one of 0 rules it out.
 *
 * The last group runs on past the digits the runs reached, so its factor is the highest of the sizes it can still
 * reach: it's never held against a group that it isn't finished yet.
 */

/** A point the envelope goes through: a group size, and the factor of a group that size, from 0 to 1. */
export interface EnvelopePoint {
  readonly size: number;
  readonly factor: number;
}

/**
 * The envelope through the points, at any size: as smooth as it can be without ever overshooting them, flat between
 * points of the same factor and beyond the first and the last. It's monotone cubic interpolation (Fritsch–Carlson),
 * with no slope at the first and last points, so that it eases out of and into the flat ends, and at every point
 * between a rise and a fall, so that it eases into and out of each extreme. Points are taken in order of size.
 */
export function envelopeOf(points: readonly EnvelopePoint[]): (size: number) => number {
  const sorted = [...points].sort((a, b) => a.size - b.size);
  const xs = sorted.map((point) => point.size);
  const ys = sorted.map((point) => point.factor);
  const widths = xs.slice(1).map((x, k) => x - (xs[k] ?? x));
  const secants = widths.map((width, k) => ((ys[k + 1] ?? 0) - (ys[k] ?? 0)) / width);
  const slopes = xs.map((_, k) => {
    const [before, after] = [secants[k - 1], secants[k]];
    const [left, right] = [widths[k - 1] ?? 0, widths[k] ?? 0];
    if (before === undefined || after === undefined || left === 0 || right === 0) {
      return 0;
    }
    if (before * after <= 0) {
      return 0;
    }
    // The weighted harmonic mean of the secants on either side, which keeps each piece monotone.
    const [w1, w2] = [2 * right + left, right + 2 * left];
    return (w1 + w2) / (w1 / before + w2 / after);
  });
  return (size) => {
    const first = xs[0];
    const last = xs.at(-1);
    if (first === undefined || last === undefined) {
      return 1;
    }
    if (size <= first) {
      return ys[0] ?? 1;
    }
    if (size >= last) {
      return ys.at(-1) ?? 1;
    }
    // The piece the size is on: from the last point at or below it.
    let k = 0;
    while ((xs[k + 1] ?? Infinity) <= size) {
      k++;
    }
    const [x0, y0, y1] = [xs[k] ?? 0, ys[k] ?? 0, ys[k + 1] ?? 0];
    const width = widths[k] ?? 1;
    const [d0, d1] = [(slopes[k] ?? 0) * width, (slopes[k + 1] ?? 0) * width];
    const t = (size - x0) / width;
    const value =
      (2 * t ** 3 - 3 * t ** 2 + 1) * y0 +
      (t ** 3 - 2 * t ** 2 + t) * d0 +
      (-2 * t ** 3 + 3 * t ** 2) * y1 +
      (t ** 3 - t ** 2) * d1;
    return Math.min(1, Math.max(0, value));
  };
}

/** The envelope: its points, and the power its factors are raised to. */
export interface Envelope {
  readonly points: readonly EnvelopePoint[];
  readonly strength: number;
}

/**
 * How much the envelope weighs a group of each size, from 0 to 1: its factor there, to the power of its strength, 0
 * staying 0 whatever the strength.
 */
export function weightOf({ points, strength }: Envelope): (size: number) => number {
  const factor = envelopeOf(points);
  return (size) => {
    const at = factor(size);
    return at === 0 ? 0 : at ** strength;
  };
}

/**
 * The envelope as hyperparameters: its strength, and the size and the factor of each point, numbered from 1, as many
 * points as there are numbers in a row.
 */
export type EnvelopeSettings = Readonly<{
  envelopeStrength: number;
  envelopeSize1: number;
  envelopeFactor1: number;
  envelopeSize2: number;
  envelopeFactor2: number;
  envelopeSize3: number;
  envelopeFactor3: number;
  envelopeSize4: number;
  envelopeFactor4: number;
}>;

/** Groups of 5 digits favored, those of 1 and 8 half as much, and none of more than 10. */
export const ENVELOPE_DEFAULTS: EnvelopeSettings = {
  envelopeStrength: 1,
  envelopeSize1: 1,
  envelopeFactor1: 0.5,
  envelopeSize2: 5,
  envelopeFactor2: 1,
  envelopeSize3: 8,
  envelopeFactor3: 0.5,
  envelopeSize4: 11,
  envelopeFactor4: 0,
};

/** The keys of the size and the factor of point `n`, from 1. */
function keysOf(n: number): { readonly size: string; readonly factor: string } {
  return { size: `envelopeSize${String(n)}`, factor: `envelopeFactor${String(n)}` };
}

/** The envelope in the hyperparameters, its strength 1 if they have none. */
export function envelopeIn(settings: Settings): Envelope {
  const points: EnvelopePoint[] = [];
  for (let n = 1; ; n++) {
    const keys = keysOf(n);
    const [size, factor] = [settings[keys.size], settings[keys.factor]];
    if (size === undefined || factor === undefined) {
      return { points, strength: settings['envelopeStrength'] ?? 1 };
    }
    points.push({ size, factor });
  }
}

/** How many points the envelope has. */
const POINTS = (Object.keys(ENVELOPE_DEFAULTS).length - 1) / 2;

/** The sliders of the envelope: its strength, then a pair for each point. */
export const ENVELOPE_HYPERPARAMETERS: readonly Hyperparameter[] = [
  {
    key: 'envelopeStrength',
    label: 'Strength',
    min: 0,
    max: 20,
    step: 0.5,
    format: (value) => (value === 1 ? '1 (the factors as they are)' : value.toFixed(1)),
    help: {
      what: 'How hard the group-size envelope weighs: each factor is raised to this power, so its log, which counts against the evidence of your runs, is this many times as much. A factor of 1 still leaves its size be, and one of 0 still rules it out.',
      why: 'The evidence of your runs adds up over them, so once you’ve played many, it says far more than a factor between 0 and 1 does: at 1, a factor of ½ only weighs 0.7 in log-odds, about what one interval a little slower than its pace says. The strength lets the envelope keep up with your runs.',
      moving:
        'Higher pushes your groups harder toward the sizes the envelope favors, even where your runs say otherwise. Lower leaves them to your runs: at 0, only the sizes at 0 count, ruled out.',
    },
  },
  ...Array.from({ length: POINTS }, (_, k) => slidersOf(k + 1)).flat(),
];

/** The pair of sliders of the envelope's point `n`, from 1: its size, then its factor. */
function slidersOf(point: number): Hyperparameter[] {
  const n = String(point);
  const keys = keysOf(point);
  const pair = `P${n}`;
  return [
    {
      key: keys.size,
      label: 'Size',
      pair,
      min: 1,
      max: 30,
      step: 1,
      format: (value) => `${String(value)} ${value === 1 ? 'digit' : 'digits'}`,
      help: {
        what: `The group size of the envelope’s point ${n}. The envelope is a factor from 0 to 1 for each size of group, through its points, smooth between them and flat beyond the first and the last: every grouping of your runs is weighed by the factor of each of its groups, so that groups too small or too big are less likely, and never at 0.`,
        why: 'Breaks are found one place at a time, from how long your runs paused there, which never keeps a group from being a single digit, or dozens. The envelope weighs all the breaks at once, so that cutting one group short never leaves the next one too long to cut well.',
        moving:
          'Moves the point along the sizes. Points need no order: they’re taken by size. Between two points of the same factor, the envelope stays flat, and it eases from one factor to the other between two that differ.',
      },
    },
    {
      key: keys.factor,
      label: 'Factor',
      pair,
      min: 0,
      max: 1,
      step: 0.05,
      format: (value) => value.toFixed(2),
      help: {
        what: `The factor of the envelope at the size of its point ${n}: how much a group that size is weighed, against 1 for one it leaves be.`,
        why: 'It weighs against the evidence of your runs, in log-odds, times the strength: at a strength of 1, a factor of ½ is worth 0.7, about what one interval a little slower than its pace says, so between 0 and 1 it mostly moves the breaks your runs aren’t sure of. 0 rules the size out whatever they say. At 1 for every point, the envelope changes nothing.',
        moving:
          'Lower makes groups of about that size less likely, so that a break that would make one moves, or goes; 0 never lets one be. Higher lets them be.',
      },
    },
  ];
}

/** Whether the envelope changes nothing: 1 at every size. */
export function isFlat({ points }: Envelope): boolean {
  return points.every((point) => point.factor === 1);
}

/**
 * The group being typed, whose start is played: it starts at index `start` and hasn't finished before index `last`.
 */
export interface Played {
  readonly start: number;
  readonly last: number;
}

/** What the envelope makes of the breaks over the places. */
export interface Enveloped {
  /** Its evidence at each index, in log-odds, infinite where it rules a break in or out. */
  readonly evidence: Values;
  /** The indices of the breaks of the best grouping, in order. */
  readonly breaks: readonly number[];
}

/**
 * The best grouping of `digits` digits, from the score of a break at each index from 1 to `digits - 1`, its log-odds
 * over the threshold, and the envelope. Given the group being typed, the groups before it are taken
 * as played: there's a break where it starts, and none after it before its last digit. Nothing if no grouping fits the
 * envelope, such as one of 0 everywhere.
 */
export function enveloped(
  scores: Values,
  digits: number,
  envelope: Envelope,
  played?: Played,
): Enveloped | undefined {
  const n = digits;
  const weight = weightOf(envelope);
  // The log of the weight by size, and of the highest it reaches from each size on, for the last group.
  const far = Math.max(n, ...envelope.points.map((point) => Math.ceil(point.size)));
  const logWeight = new Float64Array(far + 2);
  for (let size = 1; size <= far + 1; size++) {
    logWeight[size] = Math.log(weight(size));
  }
  const logReach = new Float64Array(far + 2);
  logReach[far + 1] = logWeight[far + 1] ?? -Infinity;
  for (let size = far; size >= 1; size--) {
    logReach[size] = Math.max(logWeight[size] ?? -Infinity, logReach[size + 1] ?? -Infinity);
  }
  // The longest group the envelope allows within the digits.
  let longest = 0;
  for (let size = 1; size <= n; size++) {
    if ((logWeight[size] ?? -Infinity) > -Infinity) {
      longest = size;
    }
  }
  const forced = played !== undefined && played.start > 0 && played.start < n ? played.start : n;
  const score = (i: number): number =>
    played !== undefined && i > played.start && i < played.last ? -Infinity : (scores[i] ?? 0);
  // No group spans the break where the group being typed starts.
  const limit = (c: number): number => (c < forced ? forced : n);
  const logOf = (size: number): number => logWeight[size] ?? -Infinity;
  const lastGroup = (c: number): number =>
    limit(c) === n ? (logReach[n - c] ?? -Infinity) : -Infinity;

  // The best score up to a break at each index, the groups before it included, and from it on.
  const before = new Float64Array(n).fill(-Infinity);
  before[0] = 0;
  for (let c = 1; c < n; c++) {
    let best = -Infinity;
    const from = c > forced ? forced : 0;
    for (let b = Math.max(from, c - longest); b < c; b++) {
      best = Math.max(best, (before[b] ?? -Infinity) + logOf(c - b));
    }
    before[c] = best + score(c);
  }
  const after = new Float64Array(n).fill(-Infinity);
  const next = (c: number, d: number): number => logOf(d - c) + score(d) + (after[d] ?? -Infinity);
  for (let c = n - 1; c >= 0; c--) {
    let best = lastGroup(c);
    for (let d = c + 1; d <= Math.min(n - 1, c + longest, limit(c)); d++) {
      best = Math.max(best, next(c, d));
    }
    after[c] = best;
  }
  if ((after[0] ?? -Infinity) === -Infinity) {
    return undefined;
  }

  // The best score without a break at each index: some group spans it.
  const without = new Float64Array(n).fill(-Infinity);
  for (let c = 0; c < n - 1; c++) {
    const start = before[c] ?? -Infinity;
    if (start === -Infinity) {
      continue;
    }
    const top = Math.min(n - 1, c + longest, limit(c));
    const tail = lastGroup(c);
    // The best from the break at c on with a group over each index down from the furthest one it can reach.
    let best = tail;
    for (let i = tail > -Infinity ? n - 1 : top; i > c; i--) {
      without[i] = Math.max(without[i] ?? -Infinity, start + best);
      if (i <= top) {
        best = Math.max(best, next(c, i));
      }
    }
  }

  const evidence: (number | undefined)[] = [undefined];
  for (let i = 1; i < n; i++) {
    const own = scores[i] ?? 0;
    const margin = (before[i] ?? -Infinity) + (after[i] ?? -Infinity) - (without[i] ?? -Infinity);
    evidence.push(margin - own);
  }

  // The breaks, from the first: each the last of the best next breaks, or none if ending the groups is as good.
  const breaks: number[] = [];
  for (let c = 0; ;) {
    const top = Math.min(n - 1, c + longest, limit(c));
    let best = lastGroup(c);
    let found: number | undefined;
    for (let d = top; d > c; d--) {
      const value = next(c, d);
      if (value > best) {
        best = value;
        found = d;
      }
    }
    if (found === undefined) {
      return { evidence, breaks };
    }
    breaks.push(found);
    c = found;
  }
}
