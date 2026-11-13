// `npm run promote -- <backup.json>`: makes the values tuned in a backup, as developer mode hands them back, the game's
// own, in `src/app/game-values.json`.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { promoted } from './promotion.ts';

const GAME_VALUES = 'src/app/game-values.json';

const backup = process.argv[2];
if (backup === undefined) {
  throw new Error('Name the backup: `npm run promote -- <backup.json>`.');
}
const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
// Indented, so that Prettier keeps every object expanded, a value per line, rather than folding those that fit on one.
writeFileSync(
  GAME_VALUES,
  `${JSON.stringify(promoted(read(GAME_VALUES), read(backup)), null, 2)}\n`,
);
spawnSync(process.execPath, ['node_modules/prettier/bin/prettier.cjs', '--write', GAME_VALUES], {
  stdio: 'inherit',
});
