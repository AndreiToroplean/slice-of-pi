# Slice of Pi — Roadmap

What we work on next, in order. Together, these items make a good first version: 1.0. Each item gets its own design discussions before it's built; the ideas behind them live in [`vision.md`](vision.md) and the other design docs.

## 1. The lake

The play screen becomes a scene at twilight: a lake the keypad floats on, a beach the tape lies on, hills with trees, and the night sky above. Seasons keep their meaning, but they color the scene (the water, the vegetation, the atmosphere) rather than a gradient ([`vision.md` §5.4](vision.md#54-seasons)). Stars and constellations need a real night sky to stand out.

## 2. Constellations

As the player types a group, its figure is drawn on the keypad, then lifts off into the sky above the hills ([`vision.md` §5.2](vision.md#52-keypad-gesture-patterns-constellations)). Every group the game finds in the player's runs gets one, and the sky follows their groupings as they change; it ends where the farthest place they've reached does.

- **Touch coordinates.** Figures may follow where the player actually touched each key, so their constellations are more personalized.
- **More than simple paths.** Figures need marks of their own, for instance for a digit typed twice in a row.

## 3. The sky

The main menu, Your Sky and the play screen are views of the one sky, the camera moving between them.

- **Main menu.** The camera looks up at the sky: the stars shine, silently.
- **Your Sky.** The menu's buttons fade out and the song of π plays, each star shining in its place color as its digit sounds, at the player's own pace. Scrolling sideways moves through π, the song following along.
- **Play.** The camera pans down until the horizon sits about halfway down the screen, and the game starts.

## 4. Milestones

Celebrate the places the player reaches ([`vision.md` §6](vision.md#6-game-feel-and-rewards)): fully the first time, more quietly the next few, then not at all, once reaching them has become a habit.

## 5. Leaderboards

The player against themselves: one leaderboard per feat rather than per game mode, such as the farthest place reached in a challenge, or the fastest runs to a place, with or without mistakes.

- **Worked out from the touch logs,** so a new leaderboard ranks every run ever played.
- **Only the part played by its rules.** A run counts up to where it stops playing by rules at least as strict as the leaderboard's: on one without mistakes, a Free Play run counts up to its first mistake.
- **Splits.** π has no finish line, so time is scored by milestone.
- **Digits proven.** A feat for the runs with mistakes: a digit right on the _t_-th try proves 1 − log₁₀ _t_ digits, nothing on the tenth.

## Later

- **More game modes.**
  - **Hearts.** A challenge with three hearts, which milestones give back.
  - **Recall.** The player may skip digits or go back, and the game finds where they went on in π: a jump of _d_ places costs log₁₀ _d_ digits, plus a small fixed cost.
  - **Daily slice.** The same stretch of π for the whole day.
  - **Time attack.** How far the player gets in a set time: a mode may set the pace of a whole run, never within a group.
- **Sharing your sky.**
- **Your Data.** Improve the Your Data card, in the settings.
