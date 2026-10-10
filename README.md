# Slice of Pi 🥧

A mobile-first browser game for learning and memorizing the digits of π.

Type the digits from memory, one after another, and see how far you can go.

The goal is simple: build the best π memorization game on mobile.

## Development

Requires Node.js 24 (see `.nvmrc`).

```sh
npm ci                 # install dependencies
npm start              # serve at http://localhost:4200
npm run format         # format with Prettier
npm run lint           # lint with ESLint
npm test               # run unit tests (Vitest)
npm run test:coverage  # unit tests with coverage report
npm run build          # production build into dist/
npm run check          # format check, lint, build and tests, timed against budgets
```

Every push to `main` and every pull request runs the checks (see `.github/workflows/deploy.yml`). `main` is deployed to GitHub Pages, and each pull request gets a preview linked from a comment on it.
