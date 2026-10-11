// Runs the checks due before every commit, one after another, stopping at the first that fails.
import { spawnSync } from 'node:child_process';

const steps: readonly (readonly [name: string, args: readonly string[]])[] = [
  ['format', ['run', '--silent', 'format:check']],
  ['lint', ['run', '--silent', 'lint']],
  ['build', ['run', '--silent', 'build']],
  ['test', ['test']],
];

process.exitCode = runSteps();

function runSteps(): number {
  for (const [name, args] of steps) {
    console.log(`\n▶ ${name}`);
    const { status } = spawnSync('npm', args, { stdio: 'inherit' });
    if (status !== 0) {
      console.error(`\n✖ ${name} failed`);
      return status ?? 1;
    }
  }
  console.log('\n✔ All checks passed');
  return 0;
}
