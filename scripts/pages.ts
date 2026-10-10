// The layout of the GitHub Pages site on the gh-pages branch: main's build at the root, and a preview of each open pull
// request under `pr-<number>/`. Publishing main replaces the root but keeps the previews; publishing or removing a preview
// touches only its own directory.

/** One change to the site: publish main, publish a pull request's preview, or remove a preview once its PR closes. */
export type SiteChange =
  | { readonly kind: 'publish-main' }
  | { readonly kind: 'publish-preview'; readonly pr: number }
  | { readonly kind: 'remove-preview'; readonly pr: number };

/** Tells GitHub Pages to serve the files as they are, instead of building them with Jekyll. */
export const NO_JEKYLL = '.nojekyll';

const PREVIEW_DIR = /^pr-[1-9]\d*$/;

/** The directory holding pull request `pr`'s preview, relative to the site root. */
export function previewDir(pr: number): string {
  if (!Number.isSafeInteger(pr) || pr < 1) {
    throw new RangeError(`Not a pull request number: ${String(pr)}`);
  }
  return `pr-${String(pr)}`;
}

/** Where a change puts the new build, relative to the site root, or `undefined` if it only removes files. */
export function destination(change: SiteChange): string | undefined {
  switch (change.kind) {
    case 'publish-main':
      return '.';
    case 'publish-preview':
      return previewDir(change.pr);
    case 'remove-preview':
      return undefined;
  }
}

/** The top-level entries of the site (files and directories) a change deletes before copying in the new build. */
export function entriesToRemove(entries: readonly string[], change: SiteChange): string[] {
  if (change.kind === 'publish-main') {
    return entries.filter((entry) => entry !== NO_JEKYLL && !PREVIEW_DIR.test(entry));
  }
  const dir = previewDir(change.pr);
  return entries.filter((entry) => entry === dir);
}

/** The commit message for the gh-pages commit that records a change, built from commit `sha`. */
export function commitMessage(change: SiteChange, sha?: string): string {
  const from = sha === undefined ? '' : ` from ${sha.slice(0, 7)}`;
  switch (change.kind) {
    case 'publish-main':
      return `Publish main${from}`;
    case 'publish-preview':
      return `Publish the preview of #${String(change.pr)}${from}`;
    case 'remove-preview':
      return `Remove the preview of #${String(change.pr)}`;
  }
}

/** Reads the command line of `publish-pages.ts`: `main <build>`, `preview <pr> <build>` or `remove <pr>`. */
export function parseArgs(args: readonly string[]): { change: SiteChange; build?: string } {
  const [command, first, second, ...rest] = args;
  if (rest.length === 0) {
    if (command === 'main' && first !== undefined && second === undefined) {
      return { change: { kind: 'publish-main' }, build: first };
    }
    if (command === 'preview' && first !== undefined && second !== undefined) {
      return { change: { kind: 'publish-preview', pr: parsePr(first) }, build: second };
    }
    if (command === 'remove' && first !== undefined && second === undefined) {
      return { change: { kind: 'remove-preview', pr: parsePr(first) } };
    }
  }
  throw new Error('Usage: publish-pages.ts main <build> | preview <pr> <build> | remove <pr>');
}

function parsePr(text: string): number {
  const pr = /^\d+$/.test(text) ? Number(text) : Number.NaN;
  previewDir(pr);
  return pr;
}
