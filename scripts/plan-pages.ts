// Decides what a deploy workflow run does (see `planRun`) and hands it to the later jobs as step outputs: `build`
// (true/false), `publish` (main, preview or empty), `remove` (true/false) and `base-href`.
import { appendFileSync, readFileSync } from 'node:fs';
import { planRun, previewDir } from './pages.ts';

const { GITHUB_EVENT_NAME, GITHUB_REF, GITHUB_REPOSITORY, GITHUB_EVENT_PATH, GITHUB_OUTPUT } =
  process.env;
if (
  GITHUB_EVENT_NAME === undefined ||
  GITHUB_REF === undefined ||
  GITHUB_REPOSITORY === undefined ||
  GITHUB_EVENT_PATH === undefined ||
  GITHUB_OUTPUT === undefined
) {
  throw new Error('Run from GitHub Actions, which sets the GITHUB_* variables.');
}

const { build, change } = planRun({
  eventName: GITHUB_EVENT_NAME,
  ref: GITHUB_REF,
  repository: GITHUB_REPOSITORY,
  event: JSON.parse(readFileSync(GITHUB_EVENT_PATH, 'utf8')),
});
const repo = GITHUB_REPOSITORY.split('/')[1] ?? '';
const outputs = {
  build: String(build),
  publish:
    change?.kind === 'publish-main' ? 'main' : change?.kind === 'publish-preview' ? 'preview' : '',
  remove: String(change?.kind === 'remove-preview'),
  'base-href':
    change?.kind === 'publish-preview' ? `/${repo}/${previewDir(change.pr)}/` : `/${repo}/`,
};
const lines = Object.entries(outputs).map(([name, value]) => `${name}=${value}`);
console.log(lines.join('\n'));
appendFileSync(GITHUB_OUTPUT, `${lines.join('\n')}\n`);
