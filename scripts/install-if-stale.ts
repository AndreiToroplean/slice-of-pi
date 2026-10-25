// Runs before `npm start`: installs the dependencies when the lockfile has changed since they were last installed, e.g.
// after a pull that upgraded one, and skips the install otherwise. The lockfile as of the last install is kept in
// `node_modules`, so deleting that folder brings the install back too.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { isStale } from './stale-install.ts';

const LOCKFILE = 'package-lock.json';
const INSTALLED = 'node_modules/.installed-package-lock.json';

const installed = existsSync(INSTALLED) ? readFileSync(INSTALLED, 'utf8') : undefined;
if (isStale(readFileSync(LOCKFILE, 'utf8'), installed)) {
  // The npm that runs this script, so it works wherever `npm start` does, Windows included.
  const npm = process.env['npm_execpath'];
  if (npm === undefined) {
    throw new Error('Run this through npm, e.g. `npm start`.');
  }
  const { status } = spawnSync(process.execPath, [npm, 'install', '--no-audit', '--no-fund'], {
    stdio: 'inherit',
  });
  if (status !== 0) {
    process.exit(status ?? 1);
  }
  // After the install, which may have updated the lockfile.
  copyFileSync(LOCKFILE, INSTALLED);
}
