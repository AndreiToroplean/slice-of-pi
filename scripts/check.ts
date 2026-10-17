// Runs the checks due before every commit all at once, then shows what each one said, in turn, failing if any failed.
import { spawn } from 'node:child_process';

const steps: readonly (readonly [name: string, args: readonly string[]])[] = [
  ['format', ['run', '--silent', 'format:check']],
  ['lint', ['run', '--silent', 'lint']],
  ['build', ['run', '--silent', 'build']],
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
