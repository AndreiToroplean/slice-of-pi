// Vitest settings on top of those the Angular unit-test builder gives it (`angular.json`).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    tags: [
      {
        name: 'manual',
        description:
          'Slow checks of things that never change, only run with `npm run test:manual`.',
        // npm names the script running.
        skip: process.env['npm_lifecycle_event'] !== 'test:manual',
      },
    ],
  },
});
