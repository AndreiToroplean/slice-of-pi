# Slice of Pi — Personal Digit Groupings

> Status: draft · Ideas from Andrei (2026-10-08), with the decisions taken so far and the questions still open.

## 1. The idea

Instead of imposing fixed groups of five digits (see `vision.md` §5.1), the game **accompanies the player in discovering their own chunking**.

Why:

- When people learn π, groups come to them naturally, and those groups aren't necessarily regular. A player who already knows digits in their own groups shouldn't have to relearn them in exact groups of five.
- Digits often have natural groups that each player can spot: a group of three, a repeated digit, a pattern. Seeing those is personal and up to each player.
- For a beginner, proposing groups of five may still help them learn, so five is the default hint until the player's own groups are known (§3).

The game detects groupings from **how the player types**: the time it takes them to type each digit. Digits typed quickly one after another belong together; a pause between two digits is a boundary. Over runs, the player's typing rhythm reveals their own groups.

**Constellations follow the groupings.** The keypad figures (`vision.md` §5.2) are drawn for the player's own groups rather than for fixed groups of five, which makes them more personal.

## 2. Scope: challenge mode first

The main use case for now is a player who **already knows the digits** and can type them: a challenge mode, not a practice mode. Learn modes come later.

The first version of this mode **stops at the first mistake**, so we don't have to handle mistakes in the middle of a group yet. More lenient modes, tolerating a wrong digit now and then, will come later and need their own design.

## 3. Typing a group

The play screen is centred on the group being typed, as in the chunk-centred mockup from the visual design work.

- The **typing area** shows **empty slots** for the upcoming group. The number of slots is the **hint**: the size of the group the game expects.
- The hint is **5 by default**, until the player's stats reveal their own group at that place in π (§4). This is the same in every mode for now.
- The slots are only a hint. When the player **pauses** between digits, the digits typed since the last pause become a group, whatever the hint said: typing three digits into five slots and pausing makes a group of three.
- The group then **flies off** the typing area to join the **typed digits**, shown smaller.
- The typed digits are laid out over a few rows, like text: each group is a **word**, separated from the next by a space, and rows wrap between words like text does.
- Groups have **no minimum size**: a single digit typed between two long pauses is a group of one, and its constellation is a dot.
- Groups have a **maximum size of 10** (a parameter), so the typing area stays manageable. If the player types 10 digits without pausing, the group closes at 10.

## 4. Stats and detected groupings

The game keeps **statistics of the player's typing timings**, in the spirit of typing-test sites (e.g. the open-source Monkeytype) that record every keystroke's timing and show rich stats on it.

- Every run records the **raw time each digit took to type**. Groupings formed during a run are never recorded; they're always derived from the raw timings.
- The game uses those stats to **detect the player's groupings**, and from them sets the hint (the number of empty slots) for each group.

### 4.1 Pauses

A pause is a delay that's long **for this player at this place in π**, compared with their local pace: the time they usually take for the digits around it. A player types the digits they know best faster than the last ones they know, so a fixed threshold, or one based on their overall pace, would cut the slow end into single digits. Typing one digit at a time slowly is just slow typing; a boundary is a delay clearly longer than the ones around it.

The exact formula is an implementation detail, tuned with play testing.

### 4.2 Combining runs

Boundaries are found from the timings of all runs, with **recent runs weighted more** so that a player who deliberately regroups some digits sees the game follow. The weighting is tuned with play testing.

Each run's evidence is also weighted by **confidence**: how clearly that run's timings mark pauses at that place in π. A run with sharp pauses, much longer than the delays around them, says a lot about where the player's boundaries are. A run typed fast at a steady pace, where every digit takes about the same time, says almost nothing, and barely counts. So as a player gets faster and smoother, the groups found in their earlier, more rhythmic runs are kept rather than washed out by runs that show no pauses at all.

No extra stickiness rule is needed: since groups come from all of a player's timings, one slow keystroke barely moves them. They may change a lot in the first runs, then stabilize as the player stabilizes on them.

### 4.3 When the hint follows the player

The hint switches from the default to a detected boundary once the boundary shows up in **3 of the player's last 4 runs** that reached that place with a clear rhythm; runs without clear pauses there don't count either way. Both numbers are parameters.

## 5. Other layers

- **Constellations** are drawn for the player's own groups, whatever their size; a group of one is a dot.
- **Seasons and milestones** stay counted in digits, independent of groups.

## 6. Open questions

- **Breaking a hinted group.** What happens on screen when the player pauses before the hinted size, or types past it without pausing? Proposed: a slot is added for each extra digit, up to the maximum of 10.
- **Conflicting groups.** What if boundaries from different runs overlap (e.g. 3+4 sometimes, 2+5 other times)?
- **First digits.** The very first digit, and the "3." before the decimals, have no previous digit to time from.
- **Sound and colors.** Do they attach to groups, or stay per digit?
- **Stats screen.** What stats do we show the player, and how?
- **Storage.** Raw timings per digit per run grow with play; how much do we keep, and do they need the same care as the seed?
