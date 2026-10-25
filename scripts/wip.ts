// The weekly work-in-progress builds: every Monday at 04:00 UTC (5 a.m. in Paris in winter, 6 a.m. in summer), main as
// it stands then is published under `wip/<that Monday's date>/`, unless main had no commits in the 7 days before. See
// `publish-wip.ts`.

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const PUBLISH_HOUR_UTC = 4;

/** The latest weekly publish time at or before `now`. */
export function lastPublishTime(now: Date): Date {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    PUBLISH_HOUR_UTC,
  );
  const monday = today - ((now.getUTCDay() + 6) % 7) * DAY;
  return new Date(monday > now.getTime() ? monday - WEEK : monday);
}

/** Every weekly publish time after `since` and at or before `now`, oldest first. */
export function publishTimes(since: Date, now: Date): Date[] {
  const times: Date[] = [];
  for (let time = lastPublishTime(now); time > since; time = new Date(time.getTime() - WEEK)) {
    times.unshift(time);
  }
  return times;
}

/** Whether main had commits, made at `commitTimes`, in the 7 days up to the publish time `at`. */
export function hadWork(commitTimes: readonly Date[], at: Date): boolean {
  return commitTimes.some((time) => time <= at && at.getTime() - time.getTime() < WEEK);
}

/** The date naming the build published at `at`, as `YYYY-MM-DD`. */
export function wipDate(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * `html`, a build's page, with a script run before the game that keeps the build's IndexedDB databases apart from those
 * of the game and of other builds on the site, by prefixing their names with `date`. The game takes any build outside
 * `pr-<number>/` for the main game: without this, an older build would treat the player's runs as its own.
 */
export function isolateStorage(html: string, date: string): string {
  const prefix = JSON.stringify(`wip-${date}:`);
  const script =
    `<script>(() => { const f = IDBFactory.prototype, { open, deleteDatabase } = f, p = ${prefix};` +
    ` f.open = function (n, ...a) { return open.call(this, p + n, ...a); };` +
    ` f.deleteDatabase = function (n) { return deleteDatabase.call(this, p + n); }; })();</script>`;
  if (!html.includes('<head>')) {
    throw new Error('No <head> to put the storage script in.');
  }
  return html.replace('<head>', `<head>${script}`);
}
