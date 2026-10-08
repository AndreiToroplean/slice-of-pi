/** How long the checks run before every commit may take, in milliseconds. */
export const BUDGETS = {
  total: 30_000,
  steps: { test: 10_000 } as Readonly<Partial<Record<string, number>>>,
  test: 300,
} as const;

export interface StepTiming {
  readonly name: string;
  readonly ms: number;
}

export interface SlowTest {
  readonly name: string;
  readonly ms: number;
}

/** Lists the tests in a Vitest JSON report that took longer than `thresholdMs`, slowest first. */
export function findSlowTests(report: unknown, thresholdMs: number): SlowTest[] {
  const slow: SlowTest[] = [];
  for (const file of arrayAt(report, 'testResults')) {
    for (const test of arrayAt(file, 'assertionResults')) {
      const name = valueAt(test, 'fullName');
      const ms = valueAt(test, 'duration');
      if (typeof name === 'string' && typeof ms === 'number' && ms > thresholdMs) {
        slow.push({ name, ms });
      }
    }
  }
  return slow.sort((a, b) => b.ms - a.ms);
}

/** Lists what went over its budget, one warning per line; empty when everything fit. */
export function findOverruns(
  steps: readonly StepTiming[],
  slowTests: readonly SlowTest[],
): string[] {
  const overruns: string[] = [];
  for (const step of steps) {
    const budget = BUDGETS.steps[step.name];
    if (budget !== undefined && step.ms > budget) {
      overruns.push(`${step.name} took ${seconds(step.ms)}, over its ${seconds(budget)} budget`);
    }
  }
  const total = sum(steps);
  if (total > BUDGETS.total) {
    overruns.push(`the checks took ${seconds(total)}, over their ${seconds(BUDGETS.total)} budget`);
  }
  for (const test of slowTests) {
    overruns.push(
      `"${test.name}" took ${milliseconds(test.ms)}, over the ${milliseconds(BUDGETS.test)} budget per test`,
    );
  }
  return overruns;
}

/** Formats the step timings as a table, with the total and each budget. */
export function formatTimings(steps: readonly StepTiming[]): string {
  const rows = [
    ...steps.map((step) => [step.name, seconds(step.ms), budgetLabel(BUDGETS.steps[step.name])]),
    ['total', seconds(sum(steps)), budgetLabel(BUDGETS.total)],
  ];
  const width = Math.max(...rows.map(([name = '']) => name.length));
  return rows
    .map(([name = '', time = '', budget = '']) =>
      `${name.padEnd(width)}  ${time.padStart(6)}  ${budget}`.trimEnd(),
    )
    .join('\n');
}

function budgetLabel(ms: number | undefined): string {
  return ms === undefined ? '' : `(budget ${seconds(ms)})`;
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function milliseconds(ms: number): string {
  return `${Math.round(ms).toString()}ms`;
}

function sum(steps: readonly StepTiming[]): number {
  return steps.reduce((total, step) => total + step.ms, 0);
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
