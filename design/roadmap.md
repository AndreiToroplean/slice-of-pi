# Slice of Pi — Roadmap

What we work on next, in order. Together, these items make a good first version: 1.0. Each item gets its own design discussions before it's built; the ideas behind them live in [`vision.md`](vision.md) and the other design docs.

## 1. Game modes and error detection

For now there's only the strict mode: after the player's first mistake, everything typed after it is a mistake too (glossary: [mistake](glossary.md#play)).

- **Detecting skipped digits.** A mode that detects that the player has just skipped a few digits, but is then consistent in the digits they type, meaning they match a group farther along in π. This raises a lot of questions, so there's a lot of reflection to be had.
- **Stopping conditions.** For now there are none: even when a mistake is detected, the game doesn't end, and the player can backspace and fix it.
- **The UI.** Name the modes and find a way to let the player express their choices, without overwhelming them with too many settings.

See the mode families in [`vision.md` §4](vision.md#4-game-modes).

## 2. Constellations

The constellations idea, already in the first mockup ([`vision.md` §5.2](vision.md#52-keypad-gesture-patterns-constellations)). Constellations fly off into the player's sky.

- **Touch coordinates.** Rather than aligning the figures perfectly to the grid of digit keys, we might record the actual coordinates where the player touched each key, so their constellations are more personalized.
- **More than simple paths.** Figures need indications, for instance that a digit was double tapped, because that's just how π goes. To be discussed.

## 3. Your Sky

The page where the player looks at their sky. It's really important: one of the core pages ([`vision.md` §5.2](vision.md#52-keypad-gesture-patterns-constellations)).

## 4. Your Runs

Improve the Your Runs page: its current layout isn't good.

## 5. Main menu

Redesign the main menu: the current one is a stand-in, and it should be much cooler.

## 6. Season shapes

Seasons are only colors for now ([`vision.md` §5.4](vision.md#54-seasons)). They should include shapes as well: abstract shapes that remind the player of the season, something like playing with particles in the background. To be thought through.

## 7. Sounds

The keys get sounds, yet another memory layer ([`vision.md` §5.5](vision.md#55-sound)). Each keypad row could be an instrument and each column a note, so we get many combinations. Maybe 0 is something special, like a triangle (the instrument). To be play tested.

## 8. Your Data

Improve the Your Data page. It comes after the other pages: it's less of a priority.
