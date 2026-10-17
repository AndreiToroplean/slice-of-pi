// Writes the decimals of π the game checks typed digits against, computed with the Chudnovsky series:
//
//   node scripts/write-pi-decimals.ts [count]   # 100,000 decimals by default
import { writeFileSync } from 'node:fs';
import { chudnovsky, decimalsModule } from './pi.ts';

const count = Number(process.argv[2] ?? 100_000);
writeFileSync('src/app/game/pi/pi-decimals.ts', decimalsModule(chudnovsky(count)));
console.log(`Wrote ${count.toLocaleString('en')} decimals of π to src/app/game/pi/pi-decimals.ts.`);
