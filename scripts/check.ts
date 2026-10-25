// Runs the checks due before every commit all at once, then shows what each one said, in turn, failing if any failed.
// Quicker than those of pull requests, which run them in full (`.github/workflows/deploy.yml`):
// - Prettier and ESLint only look again at the files changed since they last passed. ESLint's type-aware rules can
//   still be broken in a file left as it was by a change to another, which only a pull request then catches.
// - The production build is left to pull requests: the tests already compile the app ahead of time, templates too.
import { spawn } from 'node:child_process';

const steps: readonly (readonly [name: string, args: readonly string[]])[] = [
  ['format', ['run', '--silent', 'format:check', '--', '--cache']],
  [
    'lint',
    // In node_modules/.cache, as Prettier's.
    [
      'run',
      '--silent',
      'lint',
      '--',
      '--cache',
      '--cache-strategy',
      'content',
      '--cache-location',
      'node_modules/.cache/eslint/',
    ],
  ],
  ['test', ['test']],
];

void runSteps().then((status) => {
  process.exitCode = status;
});

async function runSteps(): Promise<number> {
  const runs = steps.map(([name, args]) => ({ name, done: run(args) }));
  let failed = 0;
  for (const { name, done } of runs) {
    const { status, output } = await done;
    console.log(`\n▶ ${name}`);
    process.stdout.write(output);
    if (status !== 0) {
      console.error(`\n✖ ${name} failed`);
      failed ||= status ?? 1;
    }
  }
  if (failed === 0) {
    console.log('\n✔ All checks passed');
  }
  return failed;
}

/** Runs npm with these arguments, keeping what it says, in color if the terminal has it, for once it's done. */
function run(args: readonly string[]): Promise<{ status: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn('npm', args, {
      env: process.stdout.isTTY ? { ...process.env, FORCE_COLOR: '1' } : process.env,
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('close', (status) => {
      resolve({ status, output });
    });
  });
}
