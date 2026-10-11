# Slice of Pi — Personal Digit Groupings

> Status: draft · Ideas from Andrei (2026-10-08), with the decisions taken so far and the questions still open.

## 1. The idea

Instead of imposing fixed groups of five digits (see `vision.md` §5.1), the game **accompanies the player in discovering their own chunking**.

Why:

- When people learn π, groups come to them naturally, and those groups aren't necessarily regular. A player who already knows digits in their own groups shouldn't have to relearn them in exact groups of five.
- Digits often have natural groups that each player can spot: a group of three, a repeated digit, a pattern. Seeing those is personal and up to each player.
- For a beginner, proposing groups of five may still help them learn, so groups of five are the default until the player's own groups are known (§3).

The game detects groupings from **how the player types**: the time it takes them to type each digit. Digits typed quickly one after another belong together; a pause between two digits is a boundary. Over runs, the player's typing rhythm reveals their own groups.

**Constellations follow the groupings.** The keypad figures (`vision.md` §5.2) are drawn for the player's own groups rather than for fixed groups of five, which makes them more personal.

## 2. Scope: challenge mode first

The main use case for now is a player who **already knows the digits** and can type them: a challenge mode, not a practice mode. Learn modes come later.

The first version of this mode is **strict**: a wrong digit shows as a mistake in its slot (a red digit and outline on almost white, since key colors fill the slots of right digits, red among them), and so does every digit typed on after it, and the group never finishes until the player deletes back to the mistake with backspace. For now a mistake doesn't end the game. Wrong digits are never recorded, so mistakes never reach the timings (§4.4). Other modes, ending the game at a mistake or tolerating a wrong digit now and then, will come later and need their own design.

## 3. Typing a group

The play screen is centred on the group being typed, as in the chunk-centred mockup from the visual design work.

- The **typing area** shows **empty slots** for the group being typed, one per digit of its size. The slots are the group: there's no separate hint, and the group finishes as soon as they're all filled.
- The size is the player's own group at that place in π where the game trusts it (§4.3), and **5** everywhere else, so a new player plays groups of 5. This is the same in every mode for now.
- When the player **pauses** before filling the slots, long enough for the aggregate to break there (§4.1), the group finishes early: typing three digits into five slots and pausing makes a group of three.
- The group then **flies off** the typing area to join the **typed digits**, shown smaller.
- The typed digits are laid out over a few rows, like text: each group is a **word**, separated from the next by a space, and rows wrap between words like text does.
- Groups have **no minimum size**: a single digit typed between two long pauses is a group of one, and its constellation is a dot.
- Groups are as long as the player's own groups, with **no maximum size**. The row of slots grows up to 10, then a new row starts below it. Mistakes typed past the last slot each add one (§2).
- The typing area shows only the slots: no text under them (no "5 digits" or similar).

## 4. Stats and detected groupings

The game keeps **statistics of the player's typing timings**, in the spirit of typing-test sites (e.g. the open-source Monkeytype) that record every keystroke's timing and show rich stats on it.

- Every run records the **raw time each digit took to type**. Groupings formed during a run are never recorded; they're always derived from the raw timings.
- The game uses those stats to **detect the player's groupings**, and from them sets the size of each group (the number of empty slots).

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

On the play screen (`src/app/play/play.ts`), the current run is one of the runs like any other, with its own recency. The only thing special about it is the digit not typed yet: its time is the time since the last digit, since the player could type it at any moment. The game keeps computing the aggregate of all the runs with it, and the group being typed is finished as soon as the aggregate breaks before the next digit. It never finishes while a mistake shows (§2).

### 4.2 Combining runs

The groupings are always computed from **all of the player's stats**, except unchecked runs (played without checking the digits, in developer mode, or from before the game checked them), which may hold mistakes: they're left out unless "Count unchecked runs", in developer mode on the "Your data" page, includes them. There's no overriding: each run's timings just add to the stats, and the groupings follow from them. Each run's evidence at a given place in π is weighted by:

- **Recency:** recent runs weigh more, so a player who deliberately regroups some digits sees the game follow. A run's weight halves every **half-life**, counted in runs (16 by default), so the groups build up over many runs while a very old pattern fades out.
- **Local confidence:** how clearly that run's timings mark pauses _at that place_. Sharp pauses, much longer than the delays around them, say a lot about where the player's boundaries are; digits typed fast at a steady pace, each taking about the same time, say almost nothing and barely count. Confidence is local because a single run can have a steady rhythm on the digits the player knows best and a very different one further on.

So as a player gets faster and smoother, the groups found where their timings were more rhythmic are kept rather than washed out. One slow keystroke barely moves anything, and groups may change a lot in the first runs, then stabilize as the player stabilizes on them. The weightings are tuned with play testing.

All the judging (what counts as a pause, confidence, detected groupings) is local to each place in π.

How the runs combine (`src/app/timing/timing-model.ts`): at each place, every run that reached it votes break or not, weighted by recency and by its local confidence (its trust). The aggregate has a boundary where the weighted share of break votes is over half, and its confidence there is the runs' agreement times the amount of evidence, which grows with the total weight of the votes and saturates.

### 4.3 How far the game follows the player

The game follows the player's detected groups from the first decimal up to the first group it isn't **confident enough** about: one whose confidence, averaged over its places, is below a **confidence threshold** (a constant), or the open group at the end of the data. That group and every one after it aren't trusted, even those confident enough, since a shaky group may not start where it should: from its start on, the game plays groups of 5. For a new player, with no data at all, that's from the very first decimal. The aggregate keeps that place (`trustedUntil` in `timing-model.ts`), and the "Your data" page dots the groups from there on.

### 4.4 Keeping the data

The raw timings of every run are recorded and **must never be lost**: they're what the player's groupings, and so their constellations, are made of. Like the seed, they're kept in the player data (`architecture.md` §5). A run records each digit typed and when. Backspace leaves no trace: it deletes the last digit's record and takes the clock back to when the digit before it was typed, so the next digit's interval runs from the backspace, as if the player had typed the run without the mistake. Where the player pressed backspace is kept in a separate record (the place of each digit deleted), which groupings don't use: they come from the timings alone. A backspace isn't necessarily a mistake, only that the player thought it was one. Mistakes, and digits typed on after them, are never recorded, but the backspaces deleting them are, at their places, and the clock goes back the same way.

### 4.5 Stats page

A technical page shows the data the groupings come from:

- **Every run, one above the other**, each as a graph of typing speed against the digit number, with **red vertical bars** at the breaks that split that run into groups.
- At the bottom, **sticky**, the **aggregate**: aggregate speed, aggregate confidence, and the groupings determined from them, which are the ones used during play.
- **Sliders for every setting** of the timing model, each with a help button saying what it is, why it works that way and what moving it does to the groups, so the settings can be tuned against real runs. They're only shown in developer mode, and the values tuned there are tweaks (`glossary.md`).

It's the "Your data" page, opened from the main menu's overflow menu.

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
