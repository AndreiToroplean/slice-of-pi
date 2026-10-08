// Runs the checks due before every commit, one after another, and reports how long each took against its budget.
// Going over a budget only warns: see "Time budgets" in CLAUDE.md for what to do about it.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BUDGETS,
  findOverruns,
  findSlowTests,
  formatTimings,
  type StepTiming,
} from './check-timing.ts';

const reportDir = mkdtempSync(join(tmpdir(), 'slice-of-pi-check-'));
const testReport = join(reportDir, 'tests.json');

const steps: readonly (readonly [name: string, args: readonly string[]])[] = [
  ['format', ['run', '--silent', 'format:check']],
  ['lint', ['run', '--silent', 'lint']],
  ['build', ['run', '--silent', 'build']],
  [
    'test',
    ['test', '--', '--reporters=json', '--reporters=default', `--output-file=${testReport}`],
  ],
];

try {
  process.exitCode = runSteps();
} finally {
  rmSync(reportDir, { recursive: true, force: true });
}

function runSteps(): number {
  const timings: StepTiming[] = [];
  for (const [name, args] of steps) {
    console.log(`\n▶ ${name}`);
    const start = performance.now();
    const { status } = spawnSync('npm', args, { stdio: 'inherit' });
    timings.push({ name, ms: performance.now() - start });
    if (status !== 0) {
      console.error(`\n✖ ${name} failed\n\n${formatTimings(timings)}`);
      return status ?? 1;
    }
  }

  const slowTests = findSlowTests(JSON.parse(readFileSync(testReport, 'utf8')), BUDGETS.test);
  const overruns = findOverruns(timings, slowTests);
  console.log(`\n✔ All checks passed\n\n${formatTimings(timings)}`);
  if (overruns.length > 0) {
    console.warn(`\n⚠ Over budget:\n${overruns.map((overrun) => `  - ${overrun}`).join('\n')}`);
  }
  return 0;
}
