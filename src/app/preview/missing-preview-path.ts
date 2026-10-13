import { UrlMatcher, UrlSegment } from '@angular/router';

/**
 * Matches the address of a pull request's preview, `pr-<number>/` and anything under it, served by the main game. The
 * site serves the main game for addresses it has no page for, so the main game is only asked for one when that preview
 * isn't published (`architecture.md` §1), or when it's a page under it that the site doesn't know of.
 */
export const missingPreview: UrlMatcher = (segments) => {
  const [first] = segments;
  const pr = first === undefined ? undefined : /^pr-([1-9]\d*)$/.exec(first.path)?.[1];
  return pr === undefined
    ? null
    : { consumed: segments, posParams: { pr: new UrlSegment(pr, {}) } };
};
