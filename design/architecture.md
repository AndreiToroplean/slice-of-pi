# Slice of Pi — Architecture Decisions

> Status: draft · Records the platform and tech-stack decisions and why we made them.

## 1. Distribution: web first

The game ships first as a **Progressive Web App (PWA)**: a website that can be installed to the home screen, opens full screen without browser bars and has its own icon. It deliberately has no offline mode: the installed app always loads the live site, so players are never stuck on an old version.

Why:

- **Reach.** Anyone can open a link, on Android and iPhone alike, with nothing to install and no store review. Updates go out instantly.
- **Play Store is hard to enter at first.** New personal developer accounts must run a closed test with at least 12 testers for 14 days before applying for production. That becomes realistic once the web version has players.
- **Installing outside the Play Store is a weak channel.** Most people see it as dangerous, and Android is moving towards requiring developer verification even for apps installed outside the Play Store (enforced from September 2026 in a few countries, globally planned for 2027), which threatens alternative app stores like F-Droid.
- **Development loop.** The app can be run and checked in a browser directly while developing, and tried on a phone immediately.

The site is served by GitHub Pages from the `gh-pages` branch (Settings → Pages → Source: "Deploy from a branch", `gh-pages`, `/ (root)`), which the deploy workflow maintains with `scripts/publish-pages.ts`: `main` at the root and previews of pull requests under `pr-<number>/`, so changes can be tried on a phone before merging. Previews are opt-in: a pull request gets one while its description contains a line `Preview: https://andreitoroplean.github.io/slice-of-pi/pr-<number>/`. Removing the line or closing the pull request deletes the preview. The web app manifest is scoped to its own directory, so an installed preview never takes over the installed main app.

## 2. Path to the Play Store

When the game has players, we package the same web app as an Android app with **Capacitor**, which wraps a web app into a native shell and gives access to native features (durable storage, haptics, …). No rewrite needed. A fully native app remains a possible later migration if the game grows enough to justify it.

## 3. App framework: Angular

The app is built with **Angular** (modern style: standalone components, signals).

Why: the game is mostly ordinary UI — screens, buttons, a keypad, transitions — which Angular handles well, and it's the framework the project owner knows best, so the code stays reviewable. Lighter frameworks would mainly bring a smaller first download, which matters little for a game players keep coming back to (the browser caches the downloaded code).

## 4. Rendering: DOM first

Most of the game is made of **regular DOM elements** animated with CSS and the Web Animations API — the keypad, digits, colors, seasonal themes, milestone effects.

- Line drawings such as the keypad gesture patterns use **inline SVG**, which is still part of the DOM and animates the same way.
- A canvas-based 2D rendering library is only brought in if and when the world/character layer needs it.

No full game engine: engines suit games that are mostly a world, and are awkward for an app that is mostly screens, text and menus.

## 5. Player data

The player data (the seed and the raw timings of every run, see `vision.md` §7 and `groupings.md` §4.4) must never be lost. Decided with Andrei on 2026-10-10:

- **IndexedDB** holds it, in the `slice-of-pi` database: one record per run, saved after every key, so leaving the game at any moment loses nothing (`src/app/runs/`). The seed will join it when it exists.
- **Persistent storage** is requested from the browser when the first run starts, so the browser doesn't evict the data when the device runs low on space. Browsers decide on their own; the runs dialog says whether it was granted.
- **A backup file** the player saves and restores from the runs dialog, from the start: browser storage can always be cleared by the player, so a file is the only copy kept outside the browser. Restoring adds the runs not kept yet and never changes those already kept. Saving a backup is manual for now.
- **Versioned records.** Runs and backup files carry a format version, and the database layout has its own version, only ever adding stores. Code leaves records in a format it doesn't know untouched. This matters because pull request previews share the main site's origin, and with it its storage, so a preview must never corrupt real progress.
- **No sync** between devices until the game has players: it would need a server and accounts.
- On iPhone, an app installed to the home screen keeps its own storage, separate from Safari's.
