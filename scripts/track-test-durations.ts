// Runs the test duration tracking in CI (see `test-durations.ts`):
//
//   node scripts/track-test-durations.ts limits <report>            # fail if the tests went over the hard limits
//   node scripts/track-test-durations.ts record <report> <output>   # write the run's benchmarks for github-action-benchmark
//   node scripts/track-test-durations.ts creep <data.js> <output>   # write an issue's body if the tests crept up
import { readFileSync, writeFileSync } from 'node:fs';
import {
  findCreep,
  findOverLimits,
  readDurations,
  readHistory,
  toBenchmarks,
} from './test-durations.ts';

const [command, input, output] = process.argv.slice(2);
if (input === undefined) {
  throw new Error('Usage: track-test-durations.ts limits|record|creep <input> [output]');
}

switch (command) {
  case 'limits': {
    const over = findOverLimits(readDurations(JSON.parse(readFileSync(input, 'utf8'))));
    for (const line of over) {
      console.error(`::error::${line}`);
    }
    process.exitCode = over.length > 0 ? 1 : 0;
    break;
  }
  case 'record': {
    const benchmarks = toBenchmarks(readDurations(JSON.parse(readFileSync(input, 'utf8'))));
    writeFileSync(required(output), JSON.stringify(benchmarks, undefined, 2));
    break;
  }
  case 'creep': {
    const creep = findCreep(readHistory(readFileSync(input, 'utf8')));
    if (creep.length > 0) {
      writeFileSync(
        required(output),
        [
          'The unit tests have been getting slower on main:',
          '',
          ...creep.map((line) => `- ${line}`),
          '',
          'Every run is recorded on the `test-durations` branch.',
        ].join('\n'),
      );
    }
    break;
  }
  default:
    throw new Error(`Unknown command: ${String(command)}`);
}

function required(path: string | undefined): string {
  if (path === undefined) {
    throw new Error(`${String(command)} needs an output path.`);
  }
  return path;
}
