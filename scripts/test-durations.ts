// Tracks how long the unit tests take, from Vitest's JSON report. CI records the last run of every merged pull request
// on the test-durations branch with github-action-benchmark, opens an issue when the tests creep up, and fails a pull
// request whose tests go over the hard limits. See `design/architecture.md` §1.

/** Hard limits a pull request's unit tests must stay under, in milliseconds. A generous backstop: creep is caught first. */
export const LIMITS = { suite: 60_000, test: 2_000 } as const;

/** How creep is detected: the median of the latest runs against the median of as many runs from further back. */
export const CREEP = {
  /** Runs in each window. Medians over 10 runs shrug off a slow CI machine or two. */
  window: 10,
  /** How many runs back the baseline window ends, before the latest window starts. */
  gap: 30,
  /** How much slower the latest runs may be than the baseline, as a fraction. Above the noise of CI machines. */
  threshold: 0.25,
} as const;

/** What a run of the unit tests took. */
export interface TestDurations {
  /** From the start of the run to the end of its last test file. */
  readonly suite: number;
  /** All the tests' own durations added up. */
  readonly tests: number;
  readonly slowest: { readonly name: string; readonly ms: number } | undefined;
}

/** One measurement in github-action-benchmark's `customSmallerIsBetter` format. */
export interface Benchmark {
  readonly name: string;
  readonly unit: 'ms';
  readonly value: number;
  readonly extra?: string;
}

/** Benchmark names, the keys of the recorded history: never rename them. */
export const SUITE = 'Unit tests: whole run';
export const TESTS = 'Unit tests: all tests added up';
export const SLOWEST = 'Unit tests: slowest test';

/** Reads the durations out of a Vitest JSON report. */
export function readDurations(report: unknown): TestDurations {
  const start = valueAt(report, 'startTime');
  let end = typeof start === 'number' ? start : 0;
  let tests = 0;
  let slowest: TestDurations['slowest'];
  for (const file of arrayAt(report, 'testResults')) {
    const fileEnd = valueAt(file, 'endTime');
    if (typeof fileEnd === 'number') {
      end = Math.max(end, fileEnd);
    }
    for (const test of arrayAt(file, 'assertionResults')) {
      const name = valueAt(test, 'fullName');
      const ms = valueAt(test, 'duration');
      if (typeof name === 'string' && typeof ms === 'number') {
        tests += ms;
        if (slowest === undefined || ms > slowest.ms) {
          slowest = { name, ms };
        }
      }
    }
  }
  return { suite: typeof start === 'number' ? end - start : 0, tests, slowest };
}

/** Turns the durations into the benchmarks recorded for each run on main. */
export function toBenchmarks(durations: TestDurations): Benchmark[] {
  const benchmarks: Benchmark[] = [
    { name: SUITE, unit: 'ms', value: Math.round(durations.suite) },
    { name: TESTS, unit: 'ms', value: Math.round(durations.tests) },
  ];
  if (durations.slowest !== undefined) {
    benchmarks.push({
      name: SLOWEST,
      unit: 'ms',
      value: Math.round(durations.slowest.ms),
      extra: durations.slowest.name,
    });
  }
  return benchmarks;
}

/** Lists what went over the hard limits, one line each; empty when everything fit. */
export function findOverLimits(durations: TestDurations): string[] {
  const over: string[] = [];
  if (durations.suite > LIMITS.suite) {
    over.push(
      `The unit tests took ${seconds(durations.suite)}, over the ${seconds(LIMITS.suite)} limit.`,
    );
  }
  if (durations.slowest !== undefined && durations.slowest.ms > LIMITS.test) {
    over.push(
      `"${durations.slowest.name}" took ${seconds(durations.slowest.ms)}, over the ${seconds(LIMITS.test)} limit per test.`,
    );
  }
  return over;
}

/** Reads each benchmark's values, oldest first, from the `data.js` github-action-benchmark keeps. */
export function readHistory(dataJs: string): Map<string, number[]> {
  const data: unknown = JSON.parse(dataJs.slice(dataJs.indexOf('{')));
  const history = new Map<string, number[]>();
  const entries = valueAt(data, 'entries');
  if (typeof entries !== 'object' || entries === null) {
    return history;
  }
  for (const runs of Object.values(entries)) {
    for (const run of Array.isArray(runs) ? (runs as unknown[]) : []) {
      for (const bench of arrayAt(run, 'benches')) {
        const name = valueAt(bench, 'name');
        const value = valueAt(bench, 'value');
        if (typeof name === 'string' && typeof value === 'number') {
          history.set(name, [...(history.get(name) ?? []), value]);
        }
      }
    }
  }
  return history;
}

/** Lists the benchmarks that crept up (see `CREEP`), one line each; empty when nothing did or there are too few runs. */
export function findCreep(history: ReadonlyMap<string, readonly number[]>): string[] {
  const creep: string[] = [];
  for (const name of [SUITE, TESTS]) {
    const values = history.get(name) ?? [];
    if (values.length < 2 * CREEP.window) {
      continue;
    }
    const baselineStart = Math.max(0, values.length - 2 * CREEP.window - CREEP.gap);
    const baseline = median(values.slice(baselineStart, baselineStart + CREEP.window));
    const latest = median(values.slice(-CREEP.window));
    if (latest > baseline * (1 + CREEP.threshold)) {
      const percent = Math.round((latest / baseline - 1) * 100);
      creep.push(
        `${name}: ${seconds(latest)} over the last ${String(CREEP.window)} runs, up ${String(percent)}% from ${seconds(baseline)}.`,
      );
    }
  }
  return creep;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function valueAt(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function arrayAt(value: unknown, key: string): readonly unknown[] {
  const array = valueAt(value, key);
  return Array.isArray(array) ? (array as unknown[]) : [];
}
