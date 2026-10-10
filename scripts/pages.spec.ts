import {
  commitMessage,
  destination,
  entriesToRemove,
  parseArgs,
  planRun,
  previewDir,
  previewUrl,
  type RunContext,
} from './pages';

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

describe('previewUrl', () => {
  it('points at the preview on GitHub Pages, whose host name is lowercase', () => {
    expect(previewUrl('AndreiToroplean/slice-of-pi', 9)).toBe(
      'https://andreitoroplean.github.io/slice-of-pi/pr-9/',
    );
  });
});

describe('planRun', () => {
  const repository = 'AndreiToroplean/slice-of-pi';
  const link = `Preview: ${previewUrl(repository, 9)}`;

  function pullRequest(action: string, body: string | null, extra: object = {}): RunContext {
    return {
      eventName: 'pull_request',
      ref: 'refs/pull/9/merge',
      repository,
      event: {
        action,
        number: 9,
        pull_request: { body, head: { repo: { full_name: repository } } },
        ...extra,
      },
    };
  }

  function edited(from: string | null, to: string | null): RunContext {
    return pullRequest('edited', to, { changes: { body: { from } } });
  }

  const preview = { kind: 'publish-preview', pr: 9 };
  const remove = { kind: 'remove-preview', pr: 9 };

  it('checks and publishes pushes to main', () => {
    expect(planRun({ eventName: 'push', ref: 'refs/heads/main', repository, event: {} })).toEqual({
      build: true,
      change: { kind: 'publish-main' },
    });
  });

  it('only checks manual runs on other branches', () => {
    expect(
      planRun({ eventName: 'workflow_dispatch', ref: 'refs/heads/topic', repository, event: {} }),
    ).toEqual({ build: true });
  });

  it.each(['opened', 'synchronize', 'reopened'])(
    'only checks a pull request without the preview link on %s',
    (action) => {
      expect(planRun(pullRequest(action, 'A CI change.'))).toEqual({ build: true });
      expect(planRun(pullRequest(action, null))).toEqual({ build: true });
    },
  );

  it.each(['opened', 'synchronize', 'reopened'])(
    'checks and publishes the preview of a pull request that links it on %s',
    (action) => {
      expect(planRun(pullRequest(action, `Before: …\n\n${link}`))).toEqual({
        build: true,
        change: preview,
      });
    },
  );

  it("ignores links to other pull requests' previews", () => {
    const other = `Preview: ${previewUrl(repository, 91)} and ${previewUrl(repository, 8)}`;
    expect(planRun(pullRequest('opened', other))).toEqual({ build: true });
  });

  it('publishes the preview when an edit adds the link', () => {
    expect(planRun(edited('Before: …', `Before: …\n${link}`))).toEqual({
      build: true,
      change: preview,
    });
    expect(planRun(edited(null, link))).toEqual({ build: true, change: preview });
  });

  it('removes the preview when an edit removes the link', () => {
    expect(planRun(edited(link, 'No preview after all.'))).toEqual({
      build: false,
      change: remove,
    });
  });

  it('does nothing for other edits', () => {
    expect(planRun(edited(link, `${link}\nTypo fixed.`))).toEqual({ build: false });
    expect(planRun(edited('Typo', 'Typo fixed.'))).toEqual({ build: false });
    expect(planRun(pullRequest('edited', link, { changes: { title: { from: 'Old' } } }))).toEqual({
      build: false,
    });
  });

  it('removes the preview when the pull request closes, whatever its description', () => {
    expect(planRun(pullRequest('closed', link))).toEqual({ build: false, change: remove });
    expect(planRun(pullRequest('closed', null))).toEqual({ build: false, change: remove });
  });

  it("only checks a fork's pull request, which can't push to gh-pages", () => {
    const fork = (action: string): RunContext => {
      const context = pullRequest(action, link);
      return {
        ...context,
        event: {
          action,
          number: 9,
          pull_request: { body: link, head: { repo: { full_name: 'someone/slice-of-pi' } } },
        },
      };
    };
    expect(planRun(fork('opened'))).toEqual({ build: true });
    expect(planRun(fork('edited'))).toEqual({ build: false });
    expect(planRun(fork('closed'))).toEqual({ build: false });
  });

  it('only checks a malformed pull request event', () => {
    expect(planRun({ eventName: 'pull_request', ref: '', repository, event: null })).toEqual({
      build: true,
    });
  });
});
