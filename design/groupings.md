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
- Groups have **no maximum size** for now. If the player types past the hint without pausing, one slot is added per digit. The row of slots grows up to 10, then a new row starts below it, again one slot at a time, and so on. We'll see in play testing whether a bound is needed after all.
- The typing area shows only the slots: no text under them (no "hint: 5" or similar).

## 4. Stats and detected groupings

The game keeps **statistics of the player's typing timings**, in the spirit of typing-test sites (e.g. the open-source Monkeytype) that record every keystroke's timing and show rich stats on it.

- Every run records the **raw time each digit took to type**. Groupings formed during a run are never recorded; they're always derived from the raw timings.
- The game uses those stats to **detect the player's groupings**, and from them sets the hint (the number of empty slots) for each group.

### 4.1 Pauses

A pause is a delay that's long **for this player at this place in π**, compared with their local pace: the time they usually take for the digits around it. A player types the digits they know best faster than the last ones they know, so a fixed threshold, or one based on their overall pace, would cut the slow end into single digits. Typing one digit at a time slowly is just slow typing; a boundary is a delay clearly longer than the ones around it.

The model (Andrei, 2026-10-08), with its constants tuned by play testing:

- **Intervals.** What we measure is the interval between two consecutive digits: the time the player took to type a digit after the previous one. The speed is its inverse.
- **Local pace.** The player's pace at a digit is a **weighted average of the intervals around it**, the weights following a **normal distribution** centred on that digit, so the pace changes smoothly rather than jumping like a plain rolling window. The width of the distribution (in digits) is a constant. For performance the tail is cut off, e.g. at 3 standard deviations, so only a bounded number of digits is ever looked at.
- **Local spread.** The **variance** of the intervals is computed with the same weights, giving a standard deviation of the intervals at that digit.
- **Breaks.** An interval counts as a **break** when it's longer than the local pace by more than a **fraction of the local standard deviation**. That fraction is a constant. Breaks separate groups.
- **Confidence.** The spread also gives the **confidence** of each break, used to **filter out noise** when the groupings are computed from the aggregate (§4.2): a very small variance means a steady rhythm, where any break is likely just noise, so **low variance means low confidence** and such breaks barely count. (Implementation note: the spread is probably best taken relative to the pace, so that a fast player's confidence isn't lowered just because all their intervals are short.)
- **Start of a run.** No pace is needed before the run starts: as soon as the player has typed two digits there's an interval, and the pace follows from the data of the run itself. (Using the pace of earlier runs over the coming digits as a starting point was considered and dropped.) What the game does with the very first intervals, while there are too few to judge, is still open (§6).

**During a run**, the groups shown on screen are never based on that run alone: they're always the groupings of the **aggregate** (§4.2), which includes the current run so far. So for a player with many runs, the only way to cut a group short during a run is a break so long that it outweighs everything else in the aggregate; there's no point in doing that on purpose. For a new player, with no other runs, the aggregate is just the current run.

### 4.2 Combining runs

The groupings are always computed from **all of the player's stats**. There's no overriding: each run's timings just add to the stats, and the groupings follow from them. Each run's evidence at a given place in π is weighted by:

- **Recency:** recent runs weigh more, so a player who deliberately regroups some digits sees the game follow.
- **Local confidence:** how clearly that run's timings mark pauses _at that place_. Sharp pauses, much longer than the delays around them, say a lot about where the player's boundaries are; digits typed fast at a steady pace, each taking about the same time, say almost nothing and barely count. Confidence is local because a single run can have a steady rhythm on the digits the player knows best and a very different one further on.

So as a player gets faster and smoother, the groups found where their timings were more rhythmic are kept rather than washed out. One slow keystroke barely moves anything, and groups may change a lot in the first runs, then stabilize as the player stabilizes on them. The weightings are tuned with play testing.

All the judging (what counts as a pause, confidence, detected groupings) is local to each place in π.

How exactly to combine the breaks of several runs is still to be designed. The inputs are each run's breaks and its local confidence, weighted by recency; the output is, at each place in π, whether there's a boundary there and how confident the game is about it. A first proposal, to try in the prototypes: at each place, a boundary score is the recency- and confidence-weighted share of runs that had a break there, and the aggregate confidence grows with the total weight of evidence and with how much the runs agree.

### 4.3 When the hint follows the player

The hint follows the player's detected groupings wherever the game is **confident enough** about them: below a **confidence threshold** (a constant), the hint switches back to the default of 5 at that place. That's also the case for a new player, with no data at all.

### 4.4 Keeping the data

The raw timings of every run are recorded and **must never be lost**: they're what the player's groupings, and so their constellations, are made of. Like the seed, they're kept in the player data (`architecture.md` §5). A run records every key pressed, backspaces included, with its time; the digits a run ends with and their times are replayed from those.

### 4.5 Stats page

A technical page shows the data the groupings come from:

- **Every run, one above the other**, each as a graph of typing speed against the digit number, with **red vertical bars** at the breaks that split that run into groups.
- At the bottom, **sticky**, the **aggregate**: aggregate speed, aggregate confidence, and the groupings determined from them, which are the ones used during play.

### 4.6 Prototype

[`prototypes/groupings-lab.html`](prototypes/groupings-lab.html) is a standalone prototype of all of the above (open it in a browser): the play screen with live groups from the aggregate, the stats page with example runs and your own, and sliders for every constant. It's plain HTML and JavaScript, separate from the app, kept as a reference until its features are ported to the game.

## 5. Other layers

- **Constellations** are drawn for the player's own groups, whatever their size; a group of one is a dot.
- **Seasons and milestones** stay counted in digits, independent of groups.

## 6. Open questions

- **Conflicting groups.** What if boundaries from different runs overlap (e.g. 3+4 sometimes, 2+5 other times)?
- **First digits.** The very first digit, and the "3." before the decimals, have no previous digit to time from. While a run has only a couple of intervals there's no pace or spread to judge breaks by yet.
- **Sound and colors.** Do they attach to groups, or stay per digit?
- **Stats for players.** Beyond the technical stats page (§4.5), what stats do we show the player, and how?
- **Growing data.** The raw timings (§4.4) grow with play; at some point we may aggregate old stats to save space, to deal with later.
