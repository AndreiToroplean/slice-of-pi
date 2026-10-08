# Slice of Pi — Personal Digit Groupings

> Status: draft · Ideas from Andrei (2026-10-08), not yet agreed on. Records the idea and the open questions to settle before building it.

## 1. The idea

Instead of imposing fixed groups of five digits (see `vision.md` §5.1), the game **accompanies the player in discovering their own chunking**.

Why:

- When people learn π, groups come to them naturally, and those groups aren't necessarily regular. A player who already knows digits in their own groups shouldn't have to relearn them in exact groups of five.
- Digits often have natural groups that each player can spot: a group of three, a repeated digit, a pattern. Seeing those is personal and up to each player.
- For a beginner, proposing groups (e.g. of five) may still help them learn. Whether to propose them, and how, is part of what to decide.

The game detects groupings from **how the player types**: the time it takes them to type each digit. Digits typed quickly one after another belong together; a pause between two digits is a boundary. Over runs, the player's typing rhythm reveals their own groups.

**Constellations follow the groupings.** The keypad figures (`vision.md` §5.2) are drawn for the player's own groups rather than for fixed groups of five, which makes them more personal.

## 2. Scope: challenge mode first

The main use case for now is a player who **already knows the digits** and can type them: a challenge mode, not a practice mode. Learn modes come later.

The first version of this mode **stops at the first mistake**, so we don't have to handle mistakes in the middle of a group yet. More lenient modes, tolerating a wrong digit now and then, will come later and need their own design.

## 3. First run: free-form groups

On the player's first run, no grouping is shown upfront. The player types as many digits as they want, at their own rhythm.

- Digits being typed appear in a **typing area**.
- When the player **pauses** between digits, the digits typed since the last pause become a group.
- The group then **flies off** the typing area to join the **typed digits**, shown smaller, as in the chunk-centred mockup from the visual design work.
- The typed digits are laid out over a few rows, like text: each group is a **word**, separated from the next by a space, and rows wrap between words like text does.

## 4. Later runs: stats and detected groupings

From the second run on, the game relies on **statistics of the player's typing timings**, in the spirit of typing-test sites (e.g. the open-source Monkeytype) that record every keystroke's timing and show rich stats on it.

- Every run records the **raw time each digit took to type**. Groupings formed during a run are never recorded; they're always derived from the raw timings.
- The game uses those stats to **detect the player's groupings**.
- Once it's **confident enough** that the player always uses a given grouping (a threshold is passed), the screen adapts: instead of letting the player type free-form, it **hints at the size of the upcoming group**. Once the group is typed, it flies off as before.
- Where the game hasn't detected anything yet, typing stays free-form. Alternatively, it could still suggest a group of five; if the player types only three digits and pauses, those three become a group.

Groupings will vary from one run to another; the stats over many runs smooth that out. No extra stickiness rule is needed: since groups come from all of a player's timings, one slow keystroke barely moves them. They may change a lot in the first runs, then stabilize as the player stabilizes on them. Whether detection starts from the second run or only after more runs isn't decided yet.

## 5. Open questions

- **Pause detection.** What counts as a pause? A fixed time, or relative to the player's own pace (e.g. much slower than their median time per digit, or than their usual time for that digit)? How does it adapt as the player gets faster?
- **Aggregating runs.** How are timings combined across runs: all runs equally, recent runs weighted more, a sliding window? With all runs weighted equally, a player who deliberately changes a group after many runs would wait a long time for the game to follow; do older runs fade out?
- **When detection starts.** From the second run, or after a minimum number of runs?
- **Confidence threshold.** How many runs, and how consistent, before the game hints at a group? What happens when the player stops following a hinted group?
- **Conflicting groups.** What if a detected group overlaps a different one from another run (e.g. 3+4 sometimes, 2+5 other times)?
- **Group size limits.** Is there a minimum or maximum group size? What about a player who types steadily with no pauses, or pauses after every digit?
- **First digits.** The very first digit, and the "3." before the decimals, have no previous digit to time from.
- **Beginners.** Do we propose groups of five to new players, and how does that coexist with detection?
- **Other layers.** How do constellations, colors and sound attach to groups of varying size? Do milestones and seasons (counted in digits) stay independent of groups?
- **Stats screen.** What stats do we show the player, and how?
- **Storage.** Raw timings per digit per run grow with play; how much do we keep, and do they need the same care as the seed?
