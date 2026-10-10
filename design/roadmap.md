# Slice of Pi — Roadmap

> Status: draft · The order in which we bring the designs into the game (2026-10-08). Each step is its own thread and pull request, with tests. Terms are defined in [`glossary.md`](glossary.md).

The reference for steps 1 to 7 is the prototype in [`prototypes/groupings-lab.html`](prototypes/groupings-lab.html): open it in a browser to see the target look and behavior. Delete it once everything in it is in the game.

## Next steps

1. **Look and feel.** Design tokens (colors, type, spacing) and fonts, the frosted keypad, and the seasons background and header: season name, year, "digit N of 100" and the four-part year bar, kept exactly as in the prototype, with no banner at season changes. Seasons hold their colors through most of a season, drifting slightly, then turn near its end (`vision.md` §5.4). The background colors are a pure function of the number of places typed, with tests.
2. **Key colors.** Place colors from π (`colors.md`): the palette, each key's accent showing the color of the next occurrence of its digit, a solid fill on press with no transition, typed digits keeping their color as joined tiles. The palette has 10 colors, picked in the prototype; freeze the mapping with golden tests once it looks right.
3. **Group screen.** Replace the perspective rows (the tape) with the typing area of slots and the typed digits laid out as words (`groupings.md` §3), with fixed groups of 5 for now. No text under the slots. Groups have no maximum size: past the hint, slots are added one at a time, rows of up to 10. This also removes the slowest unit test, which keeps the pre-commit check over budget.
4. **Player data.** Record the raw timings of every run in storage that's never lost, on the web and in the installed PWA (`groupings.md` §4.4): IndexedDB, with persistent storage requested from the browser, plus saving and restoring a backup file (`architecture.md` §5).
5. **Timing model.** Intervals, pace, spread, breaks, confidence and the aggregate (`groupings.md` §4.1 to §4.3), as a pure TypeScript module with thorough tests. Its constants live in one place, to be tuned by play testing.
6. **Stats page.** The technical page of `groupings.md` §4.5: every run's chart with its breaks, and the sticky aggregate.
7. **Live groups.** Groups on screen follow the aggregate, current run included, and the hint follows the player where the aggregate is confident enough (`groupings.md` §4.1 and §4.3).

## Later

- **Constellations** drawn on the keypad as a group is typed (`vision.md` §5.2), then the **sky**: constellations flying into a seeded 3D sky, which the player can open to admire, and later share.
- Sound, milestones and streaks, then learn modes.
