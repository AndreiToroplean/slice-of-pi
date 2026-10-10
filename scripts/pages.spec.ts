import { commitMessage, destination, entriesToRemove, parseArgs, previewDir } from './pages';

const site = ['.nojekyll', '404.html', 'index.html', 'main-ABC.js', 'icons', 'pr-7', 'pr-12'];

describe('previewDir', () => {
  it('names the directory after the pull request', () => {
    expect(previewDir(7)).toBe('pr-7');
  });

  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('rejects %d', (pr) => {
    expect(() => previewDir(pr)).toThrow(RangeError);
  });
});

describe('destination', () => {
  it('puts main at the site root', () => {
    expect(destination({ kind: 'publish-main' })).toBe('.');
  });

  it("puts a preview in its pull request's directory", () => {
    expect(destination({ kind: 'publish-preview', pr: 7 })).toBe('pr-7');
  });

  it('puts nothing anywhere when removing a preview', () => {
    expect(destination({ kind: 'remove-preview', pr: 7 })).toBeUndefined();
  });
});

describe('entriesToRemove', () => {
  it("replaces main's files but keeps the previews and .nojekyll", () => {
    expect(entriesToRemove(site, { kind: 'publish-main' })).toEqual([
      '404.html',
      'index.html',
      'main-ABC.js',
      'icons',
    ]);
  });

  it("removes main's files that only look like previews", () => {
    expect(entriesToRemove(['pr-', 'pr-07', 'pr-7x', 'pr-7'], { kind: 'publish-main' })).toEqual([
      'pr-',
      'pr-07',
      'pr-7x',
    ]);
  });

  it.each(['publish-preview', 'remove-preview'] as const)(
    'touches only its own preview on %s',
    (kind) => {
      expect(entriesToRemove(site, { kind, pr: 7 })).toEqual(['pr-7']);
    },
  );

  it('removes nothing for a preview that was never published', () => {
    expect(entriesToRemove(site, { kind: 'remove-preview', pr: 1 })).toEqual([]);
  });

  it('removes nothing from an empty site', () => {
    expect(entriesToRemove([], { kind: 'publish-main' })).toEqual([]);
  });
});

describe('commitMessage', () => {
  const sha = '0123456789abcdef';

  it('names the change and the short commit it was built from', () => {
    expect(commitMessage({ kind: 'publish-main' }, sha)).toBe('Publish main from 0123456');
    expect(commitMessage({ kind: 'publish-preview', pr: 7 }, sha)).toBe(
      'Publish the preview of #7 from 0123456',
    );
  });

  it('leaves out the commit when it is unknown or irrelevant', () => {
    expect(commitMessage({ kind: 'publish-main' })).toBe('Publish main');
    expect(commitMessage({ kind: 'remove-preview', pr: 7 }, sha)).toBe('Remove the preview of #7');
  });
});

describe('parseArgs', () => {
  it('reads each command', () => {
    expect(parseArgs(['main', 'dist'])).toEqual({
      change: { kind: 'publish-main' },
      build: 'dist',
    });
    expect(parseArgs(['preview', '7', 'dist'])).toEqual({
      change: { kind: 'publish-preview', pr: 7 },
      build: 'dist',
    });
    expect(parseArgs(['remove', '7'])).toEqual({ change: { kind: 'remove-preview', pr: 7 } });
  });

  it.each([
    [],
    ['main'],
    ['main', 'dist', 'extra'],
    ['preview', '7'],
    ['remove'],
    ['remove', '7', 'dist'],
    ['publish', 'dist'],
  ])('rejects a wrong command line: %j', (...args) => {
    expect(() => parseArgs(args)).toThrow(/Usage/);
  });

  it.each(['0', '-7', '7.5', '0x7', '', ' 7'])('rejects the pull request number %j', (pr) => {
    expect(() => parseArgs(['remove', pr])).toThrow(RangeError);
  });
});
