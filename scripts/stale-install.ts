// Tells when the dependencies need installing before `npm start` (see `install-if-stale.ts`).

/** Whether the dependencies need installing: never installed through here, or installed from another lockfile. */
export function isStale(lockfile: string, installed: string | undefined): boolean {
  return lockfile !== installed;
}
