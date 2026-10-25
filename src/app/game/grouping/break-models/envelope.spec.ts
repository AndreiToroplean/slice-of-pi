import {
  ENVELOPE_DEFAULTS,
  ENVELOPE_HYPERPARAMETERS,
  Envelope,
  enveloped,
  envelopeIn,
  envelopeOf,
  EnvelopePoint,
  weightOf,
} from './envelope';

/** No group of 1 digit, nor of more than 10, fading from 5 to 11. */
const USUAL: readonly EnvelopePoint[] = [
  { size: 1, factor: 0 },
  { size: 2, factor: 1 },
  { size: 5, factor: 1 },
  { size: 11, factor: 0 },
];
const ENVELOPE: Envelope = { points: USUAL, strength: 1 };

describe('envelopeOf', () => {
  const envelope = envelopeOf(USUAL);

  it('goes through its points, flat between those of the same factor and beyond the ends', () => {
    expect([0, 1, 2, 3, 4, 5, 11, 12, 40].map(envelope)).toEqual([0, 0, 1, 1, 1, 1, 0, 0, 0]);
  });

  it('eases from one factor to the next, smoothly, without leaving them', () => {
    const fade = [6, 7, 8, 9, 10].map(envelope);

    expect(fade[2]).toBeCloseTo(0.5, 12);
    fade.forEach((factor, k) => {
      expect(factor).toBeLessThan(k === 0 ? 1 : (fade[k - 1] ?? 0));
      expect(factor).toBeGreaterThan(0);
    });
    // No slope at either end of the fade: it eases out of 1 and into 0.
    expect(1 - envelope(5.01)).toBeLessThan(0.001);
    expect(envelope(10.99)).toBeLessThan(0.001);
  });

  it('never overshoots a point between a rise and a fall, whatever their spacing', () => {
    const peak = envelopeOf([
      { size: 1, factor: 0 },
      { size: 3, factor: 0.6 },
      { size: 4, factor: 1 },
      { size: 20, factor: 0.2 },
    ]);
    const sizes = Array.from({ length: 220 }, (_, k) => k / 10);

    expect(Math.max(...sizes.map(peak))).toBe(1);
    expect(Math.min(...sizes.map(peak))).toBe(0);
  });

  it('takes the points in order of size, however many', () => {
    const shuffled = envelopeOf([...USUAL].reverse());
    const more = envelopeOf([...USUAL, { size: 20, factor: 0.5 }]);

    expect([3, 7, 9].map(shuffled)).toEqual([3, 7, 9].map(envelope));
    expect(more(15.5)).toBeCloseTo(0.25, 12);
    expect(more(30)).toBe(0.5);
  });
});

describe('the envelope as hyperparameters', () => {
  it('reads its strength and as many points as are numbered in a row', () => {
    expect(envelopeIn(ENVELOPE_DEFAULTS)).toEqual(ENVELOPE);
    expect(envelopeIn({ envelopeSize1: 3, envelopeFactor1: 0.5, envelopeSize3: 9 })).toEqual({
      points: [{ size: 3, factor: 0.5 }],
      strength: 1,
    });
  });

  it('has a slider for its strength, then a pair for the size and the factor of each point', () => {
    expect(ENVELOPE_HYPERPARAMETERS.map((slider) => slider.key)).toEqual(
      Object.keys(ENVELOPE_DEFAULTS),
    );
    expect(ENVELOPE_HYPERPARAMETERS.map((slider) => slider.pair)).toEqual([
      undefined,
      'P1',
      'P1',
      'P2',
      'P2',
      'P3',
      'P3',
      'P4',
      'P4',
    ]);
  });

  it('raises its factors to its strength, leaving 0 and 1 as they are', () => {
    const at = (strength: number) => [1, 3, 8].map(weightOf({ points: USUAL, strength }));

    expect(at(1)).toEqual([0, 1, 0.5]);
    expect(at(3)).toEqual([0, 1, 0.125]);
    expect(at(0)).toEqual([0, 1, 1]);
  });
});

describe('enveloped', () => {
  /** Scores by index from 1, as `enveloped` takes them. */
  const byIndex = (scores: readonly number[]) => [undefined, ...scores];

  /** Every grouping of `digits` digits, by its breaks, and its score. */
  function bruteForce(
    scores: readonly number[],
    digits: number,
    shape: Envelope,
  ): { readonly breaks: readonly number[]; readonly score: number }[] {
    const envelope = weightOf(shape);
    const sizes = Array.from({ length: 200 }, (_, k) => envelope(k + 1));
    // The last group runs on: the highest factor of the sizes it can still reach, by its size so far.
    const runningOn = sizes.map((_, k) => Math.max(...sizes.slice(k)));
    return Array.from({ length: 2 ** (digits - 1) }, (_, mask) => {
      const breaks = Array.from({ length: digits - 1 }, (_, k) => k + 1).filter(
        (i) => (mask >> (i - 1)) & 1,
      );
      const starts = [0, ...breaks];
      const closed = breaks.reduce(
        (sum, end, k) => sum + Math.log(envelope(end - (starts[k] ?? 0))) + (scores[end - 1] ?? 0),
        0,
      );
      const last = digits - (starts.at(-1) ?? 0);
      return { breaks, score: closed + Math.log(runningOn[last - 1] ?? 0) };
    });
  }

  /** Scores drawn from a seeded generator, so that every run tests the same ones. */
  function scoresOf(count: number, seed: number): number[] {
    let state = seed;
    return Array.from({ length: count }, () => {
      state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
      return (state / 2 ** 31) * 8 - 5;
    });
  }

  it('finds the best grouping over all the places at once, and its evidence at each', () => {
    const digits = 14;
    for (let seed = 1; seed <= 20; seed++) {
      // A strength of 3 for every other seed.
      const shape = { points: USUAL, strength: seed % 2 === 0 ? 3 : 1 };
      const scores = scoresOf(digits - 1, seed);
      const all = bruteForce(scores, digits, shape);
      const best = Math.max(...all.map((grouping) => grouping.score));
      const shaped = enveloped(byIndex(scores), digits, shape);
      const found = all.find((grouping) => grouping.breaks.join() === shaped?.breaks.join());

      expect(found?.score).toBeCloseTo(best, 9);
      // The best score of the groupings breaking at each place, and of those that don't.
      const bestWith = Array<number>(digits).fill(-Infinity);
      const bestWithout = Array<number>(digits).fill(-Infinity);
      for (const { breaks, score } of all) {
        for (let i = 1; i < digits; i++) {
          const into = breaks.includes(i) ? bestWith : bestWithout;
          into[i] = Math.max(into[i] ?? -Infinity, score);
        }
      }
      for (let i = 1; i < digits; i++) {
        const margin = (bestWith[i] ?? NaN) - (bestWithout[i] ?? NaN);
        const evidence = shaped?.evidence[i] ?? NaN;
        if (Number.isFinite(margin)) {
          expect(evidence + (scores[i - 1] ?? 0)).toBeCloseTo(margin, 9);
        } else {
          expect(evidence).toBe(margin);
        }
        // Over the threshold just where the best grouping breaks.
        expect(evidence + (scores[i - 1] ?? 0) > 0).toBe(shaped?.breaks.includes(i));
      }
    }
  });

  it('changes nothing at 1 for every size', () => {
    const scores = scoresOf(29, 7);
    const flat = USUAL.map((point) => ({ ...point, factor: 1 }));
    const shaped = enveloped(byIndex(scores), 30, { points: flat, strength: 5 });

    shaped?.evidence.slice(1).forEach((evidence) => {
      expect(evidence).toBeCloseTo(0, 9);
    });
    expect(shaped?.breaks).toEqual(scores.flatMap((score, k) => (score > 0 ? [k + 1] : [])));
  });

  it('rules out a group of a size of factor 0, whatever the runs say', () => {
    // Two strong breaks a digit apart: only the stronger stays.
    const scores = Array<number>(9).fill(-5);
    scores[2] = 5;
    scores[3] = 4;
    const shaped = enveloped(byIndex(scores), 10, ENVELOPE);

    expect(shaped?.breaks).toEqual([3]);
    // As much against the weaker one as it takes to keep it under the threshold.
    expect((shaped?.evidence[4] ?? NaN) + 4).toBeLessThan(0);
  });

  it('cuts a group too long where the runs say least against it', () => {
    const scores = Array<number>(29).fill(-5);
    for (const at of [8, 17, 25]) {
      scores[at - 1] = -1;
    }

    expect(enveloped(byIndex(scores), 30, ENVELOPE)?.breaks).toEqual([8, 17, 25]);
  });

  it('never holds it against the last group that it can still grow', () => {
    // Short: it may end anywhere yet. Too long: it must have been cut.
    expect(enveloped(byIndex(Array<number>(5).fill(-1)), 6, ENVELOPE)?.breaks).toEqual([]);
    expect(enveloped(byIndex(Array<number>(14).fill(-1)), 15, ENVELOPE)?.breaks).not.toEqual([]);
  });

  it('takes the groups before the one being typed as played', () => {
    const scores = Array<number>(19).fill(-3);
    scores[6] = 4;
    const shaped = enveloped(byIndex(scores), 20, ENVELOPE, { start: 5, last: 9 });

    // A break where it starts, none in it before its last digit, so not where the runs break.
    expect(shaped?.breaks).toContain(5);
    expect(shaped?.breaks).not.toContain(7);
    expect(shaped?.evidence[5]).toBe(Infinity);
    expect(shaped?.evidence[7]).toBe(-Infinity);
    // Already 4 digits long, it may still end at its last digit.
    expect(shaped?.evidence[9]).toBeGreaterThan(-Infinity);
  });

  it('ends the group being typed once it reaches the largest size allowed', () => {
    const scores = Array<number>(29).fill(-5);
    const shaped = enveloped(byIndex(scores), 30, ENVELOPE, { start: 3, last: 13 });

    expect(shaped?.evidence[13]).toBe(Infinity);
  });

  it('gives nothing when no grouping fits', () => {
    const none = USUAL.map((point) => ({ ...point, factor: 0 }));

    expect(enveloped(byIndex([1, -1, 2]), 4, { points: none, strength: 1 })).toBeUndefined();
  });
});
