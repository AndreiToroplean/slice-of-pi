// Runs before every test file (see `setupFiles` in `angular.json`).

/** Gives the document the `fonts` jsdom lacks, with every font already loaded, as when they are cached. */
Object.defineProperty(document, 'fonts', {
  configurable: true,
  value: { ready: Promise.resolve() },
});
