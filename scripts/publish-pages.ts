// Publishes a build to the gh-pages branch, which GitHub Pages serves (see `design/architecture.md` §1). Run from a clone
// that can push to `origin`, as the deploy workflow does:
//
//   node scripts/publish-pages.ts main <build>        # main's build at the site root, keeping the previews
//   node scripts/publish-pages.ts preview <pr> <build> # a pull request's preview under pr-<number>/
//   node scripts/publish-pages.ts remove <pr>          # delete a pull request's preview
//
// gh-pages keeps a single commit, replaced on every publish, so old builds don't pile up in the repository. Runs racing
// for the branch push with a lease and start over from the newer commit when they lose.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  NO_JEKYLL,
  commitMessage,
  destination,
  entriesToRemove,
  parseArgs,
  type SiteChange,
} from './pages.ts';

const BRANCH = 'gh-pages';
const ATTEMPTS = 5;

const { change, build } = parseArgs(process.argv.slice(2));

for (let attempt = 1; ; attempt++) {
  if (publish(change, build)) {
    break;
  }
  if (attempt === ATTEMPTS) {
    throw new Error(`Gave up after ${String(ATTEMPTS)} attempts: ${BRANCH} kept moving.`);
  }
  console.log(`${BRANCH} moved while publishing; trying again.`);
}

/** Applies `change` on top of the current gh-pages and pushes it. Returns false if gh-pages moved in the meantime. */
function publish(change: SiteChange, build: string | undefined): boolean {
  const work = mkdtempSync(join(tmpdir(), 'slice-of-pi-pages-'));
  try {
    const site = join(work, 'site');
    mkdirSync(site);
    const current = fetchCurrent();
    if (current !== undefined) {
      // Through a file: the site outgrows the output a child process may buffer.
      const archive = join(work, 'site.tar');
      git(['archive', '--output', archive, current]);
      execFileSync('tar', ['-x', '-f', archive, '-C', site]);
    }

    for (const entry of entriesToRemove(readdirSync(site), change)) {
      rmSync(join(site, entry), { recursive: true, force: true });
    }
    const target = destination(change);
    if (target !== undefined && build !== undefined) {
      cpSync(build, join(site, target), { recursive: true });
    }
    writeFileSync(join(site, NO_JEKYLL), '');

    const env = { ...process.env, GIT_INDEX_FILE: join(work, 'index') };
    git(['--work-tree', site, 'add', '--all', '.'], env);
    const tree = git(['write-tree'], env).toString().trim();
    const message = commitMessage(change, process.env['GITHUB_SHA']);
    if (
      current !== undefined &&
      tree ===
        git(['rev-parse', `${current}^{tree}`])
          .toString()
          .trim()
    ) {
      console.log(`${message}: nothing to change on ${BRANCH}.`);
      return true;
    }
    const commit = git(['commit-tree', tree, '-m', message]).toString().trim();

    try {
      git([
        'push',
        `--force-with-lease=refs/heads/${BRANCH}:${current ?? ''}`,
        'origin',
        `${commit}:refs/heads/${BRANCH}`,
      ]);
    } catch {
      return false;
    }
    console.log(`${message}: pushed ${commit.slice(0, 7)} to ${BRANCH}.`);
    return true;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Fetches gh-pages and returns its commit, or `undefined` if the branch doesn't exist yet. */
function fetchCurrent(): string | undefined {
  const line = git(['ls-remote', 'origin', `refs/heads/${BRANCH}`])
    .toString()
    .trim();
  if (line === '') {
    return undefined;
  }
  git(['fetch', '--depth=1', 'origin', `refs/heads/${BRANCH}`]);
  return git(['rev-parse', 'FETCH_HEAD']).toString().trim();
}

function git(args: readonly string[], env: NodeJS.ProcessEnv = process.env): Buffer {
  return execFileSync('git', args, { env, stdio: ['ignore', 'pipe', 'inherit'] });
}
