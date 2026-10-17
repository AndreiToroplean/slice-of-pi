// Computes the decimals of π that the game checks typed digits against (`src/app/game/pi/pi-decimals.ts`, written by
// `write-pi-decimals.ts`).

/**
 * The first `decimals` decimals of π: the Chudnovsky series, summed exactly with binary splitting, in integers scaled by
 * 10^(decimals + guard). 100,000 decimals take well under a second.
 */
export function chudnovsky(decimals: number): string {
  const guard = 10;
  // Each term of the series adds a little over 14 decimals.
  const [, q, t] = split(0, Math.ceil(decimals / 14) + 2);
  const one = 10n ** BigInt(decimals + guard);
  const pi = (q * 426880n * squareRoot(10005n * one * one)) / t;
  return pi.toString().slice(1, decimals + 1);
}

/** The source of `src/app/game/pi/pi-decimals.ts`, holding these decimals. */
export function decimalsModule(decimals: string): string {
  return `/**
 * The first ${decimals.length.toLocaleString('en')} decimals of π, place 1 first: beyond what anyone has recited from memory. Written by
 * \`scripts/write-pi-decimals.ts\` with the Chudnovsky series, and checked against other computations by the manual
 * tests in \`scripts/pi.spec.ts\` (\`npm run test:manual\`).
 */
export const PI_DECIMALS =
  '${decimals}';
`;
}

const C3_OVER_24 = 640320n ** 3n / 24n;

/** The products P and Q and the sum T of the series' terms from `a` to `b`, `b` left out. */
function split(a: number, b: number): [bigint, bigint, bigint] {
  if (b - a === 1) {
    if (a === 0) {
      return [1n, 1n, 13591409n];
    }
    const k = BigInt(a);
    const p = (6n * k - 5n) * (2n * k - 1n) * (6n * k - 1n);
    const t = p * (13591409n + 545140134n * k);
    return [p, k * k * k * C3_OVER_24, a % 2 === 0 ? t : -t];
  }
  const middle = (a + b) >> 1;
  const [p1, q1, t1] = split(a, middle);
  const [p2, q2, t2] = split(middle, b);
  return [p1 * p2, q1 * q2, q2 * t1 + p1 * t2];
}

/** The integer square root, by Newton's method from above, starting from the root of the number's top half. */
function squareRoot(n: bigint): bigint {
  const bits = n.toString(2).length;
  if (bits <= 52) {
    return BigInt(Math.floor(Math.sqrt(Number(n))));
  }
  const half = BigInt(bits >> 2);
  let x = (squareRoot(n >> (half * 2n)) + 1n) << half;
  for (;;) {
    const next = (x + n / x) >> 1n;
    if (next >= x) {
      return x;
    }
    x = next;
  }
}
