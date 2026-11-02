// Vitest settings on top of those the Angular unit-test builder gives it (`angular.json`).
import { defineConfig } from 'vitest/config';

// npm names the script running.
const script = process.env['npm_lifecycle_event'];

export default defineConfig({
  test: {
    // About 5% quicker than the default of a process per worker.
    pool: 'threads',
    tags: [
      {
        name: 'manual',
        description:
          'Slow checks of things that never change, only run with `npm run test:manual`.',
        skip: script !== 'test:manual',
      },
      {
        name: 'disabled',
        description:
          'Tests on trial, thought not worth their time: only run with `npm run test:all` (see CLAUDE.md).',
        skip: script !== 'test:all',
      },
    ],
  },
});
