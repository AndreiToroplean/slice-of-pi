// Builds the weekly work-in-progress builds (see `wip.ts`) and publishes them with `publish-pages.ts`. Run from a full
// clone that can push to `origin`, as the wip workflow does:
//
//   node scripts/publish-wip.ts             # this week's build
//   node scripts/publish-wip.ts --backfill  # every week's build since the first commit
//
// Each build is made from its commit of main in a worktree of its own, with that commit's dependencies and the current
// Node.js. Weeks whose commit has nothing to build yet are skipped.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wipDir } from './pages.ts';
import { hadWork, isolateStorage, lastPublishTime, publishTimes, wipDate } from './wip.ts';

const MAIN = 'origin/main';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--backfill')) {
  throw new Error('Usage: publish-wip.ts [--backfill]');
}
const repo = process.env['GITHUB_REPOSITORY']?.split('/')[1] ?? 'slice-of-pi';

// Newest first. Pull requests are rebased onto main, so a commit's committer time is when it reached main.
const commits = git(['log', MAIN, '--first-parent', '--format=%H %cI'])
  .trim()
  .split('\n')
  .map((line) => {
    const [sha = '', time = ''] = line.split(' ');
    return { sha, time: new Date(time) };
  });
const times = commits.map(({ time }) => time);
const now = new Date();
const oldest = times.at(-1) ?? now;

for (const at of args.length === 1 ? publishTimes(oldest, now) : [lastPublishTime(now)]) {
  const date = wipDate(at);
  const commit = commits.find(({ time }) => time <= at);
  if (!hadWork(times, at) || commit === undefined) {
    console.log(`${date}: no commits in the week before, skipped.`);
    continue;
  }
  if (!git(['ls-tree', '--name-only', commit.sha, 'package.json']).trim()) {
    console.log(`${date}: nothing to build at ${commit.sha.slice(0, 7)}, skipped.`);
    continue;
  }
  const worktree = mkdtempSync(join(tmpdir(), 'slice-of-pi-wip-'));
  try {
    console.log(`${date}: building ${commit.sha.slice(0, 7)}.`);
    git(['worktree', 'add', '--detach', worktree, commit.sha]);
    run('npm', ['ci'], worktree);
    run('npm', ['run', 'build', '--', '--base-href', `/${repo}/${wipDir(date)}/`], worktree);
    const build = join(worktree, 'dist', 'slice-of-pi', 'browser');
    const page = join(build, 'index.html');
    writeFileSync(page, isolateStorage(readFileSync(page, 'utf8'), date));
    // Serve the app for unknown paths too, so client-side routes survive a reload.
    copyFileSync(page, join(build, '404.html'));
    run('node', ['scripts/publish-pages.ts', 'wip', date, build], process.cwd(), {
      GITHUB_SHA: commit.sha,
    });
  } finally {
    git(['worktree', 'remove', '--force', worktree]);
    rmSync(worktree, { recursive: true, force: true });
  }
}

function git(args: readonly string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv = {},
): void {
  execFileSync(command, args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit' });
}
