import { isStale } from './stale-install';

describe('isStale', () => {
  it('installs when the dependencies were never installed through it', () => {
    expect(isStale('{"lockfileVersion": 3}', undefined)).toBe(true);
  });

  it('installs when the lockfile has changed since the last install', () => {
    expect(isStale('{"lockfileVersion": 3, "a": 2}', '{"lockfileVersion": 3, "a": 1}')).toBe(true);
  });

  it('skips the install when the lockfile is the one last installed', () => {
    expect(isStale('{"lockfileVersion": 3}', '{"lockfileVersion": 3}')).toBe(false);
  });
});
