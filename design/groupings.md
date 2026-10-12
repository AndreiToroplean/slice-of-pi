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
- Within the trust horizon (§4.3), the size is the player's own group at that place in π, and the group finishes when they're filled, or earlier where the player usually breaks.
- Past it, the group starts with **5** slots and finishes when the player **breaks** (§4.1): typing three digits into five slots and pausing makes a group of three. Filling the slots without a break adds one more, so the group grows until the player breaks. So a player whose groups the game doesn't know yet shows it their groups.
- This is the same from a new player's very first digit (§4.1), and in every mode for now.
- The group then **flies off** the typing area to join the **typed digits**, shown smaller.
- The typed digits are laid out over a few rows, like text: each group is a **word**, separated from the next by a space, and rows wrap between words like text does.
- Groups have **no minimum size**: a single digit typed between two long pauses is a group of one, and its constellation is a dot.
- Groups are as long as the player's own groups, with **no maximum size**. The row of slots grows up to 10, then a new row starts below it. Mistakes typed past the last slot each add one (§2).
- The typing area shows only the slots: no text under them (no "5 digits" or similar).

## 4. Stats and detected groupings

The game keeps **statistics of the player's typing timings**, in the spirit of typing-test sites (e.g. the open-source Monkeytype) that record every keystroke's timing and show rich stats on it.

- Every run records the **raw time each digit took to type**. Groupings formed during a run are never recorded; they're always derived from the raw timings.
- The game uses those stats to **detect the player's groupings**, and from them sets the size of each group (the number of empty slots).

### 4.1 Breaks

A break is a delay that's long **for this player at this place in π**, relative to their current speed: at a ~100 ms baseline, 150 ms could count. A player types the digits they know best faster than the last ones they know, so a fixed threshold, or one based on their overall speed, would cut the slow end into single digits. Typing one digit at a time slowly is just slow typing; a break is a delay clearly longer than the ones around it.

Telling breaks apart is classifying the outliers of a series of intervals, across repeated runs of the same sequence, where index i is the same place in π in every run. The break model (`src/app/timing/break-model.ts`), translated from a method a data scientist gave us:

1. **Log intervals.** What we measure is the **interval** between two consecutive digits. The model works in log(interval), since breaks are multiplicative: "x% slower than usual".
2. **Baseline.** Each run has a baseline, its expected log-interval at each place without the breaks. A finished run's is a **centered rolling median** along its places. The run being typed uses only what has been typed so far: the **historical speed curve** (the recency-weighted mean of the finished runs' baselines) plus this run's own offset from it, a **trailing rolling median**; past the end of all history, a trailing rolling median of the run itself. While the run has few intervals to go on, its offset is **shrunk toward a prior**, the finished runs' recency-weighted typical offset: with n intervals seen (up to a window), offset = (k₀ · prior + n · trailing median) / (k₀ + n), k₀ being the **prior strength**. In the very first run, with no history, the run's own trailing median is shrunk the same way toward a **prior baseline**. Without it, the first interval of a run would be its own baseline, so never a break, and a break among the next few would pull the baseline up and hide. The baseline is smooth along the places on purpose: a median at each place across runs would absorb breaks the player makes at the same place every time.
3. **Residual.** log(interval) − baseline.
4. **Mixture.** A **mixture of two normal distributions**, normal and break, is fitted to all the residuals of all runs pooled, each weighted by its run's recency weight (§4.2), by weighted EM (expectation–maximization). To keep it cheap on every keystroke, each fit starts from the last one.
5. **P(break).** The probability that an interval is a break is the posterior of the break component, forced to 0 below the normal mean: a break is never faster than usual.

A mixture fitted to a handful of residuals can't learn yet what a break looks like. So until there are **fit from** intervals over all runs (50 by default), a **prior mixture** stands in for it, as it is: a best-effort guess for every player, normal intervals around their baseline and breaks a few times longer. That way the game tells breaks from a new player's very first digit. (A game with many players could take its prior from them; this one has its hyperparameters instead.)

The hyperparameters, tuned with play testing in developer mode (§4.5): **window**, the rolling-median window in intervals (21 by default); **recency decay** (§4.2); **level** (§4.3); **prior strength** (5 intervals); **prior baseline** (300 ms); **fit from**; and the prior mixture's **break share** (15%), **break size** (2.5 times the baseline), **normal spread** and **break spread** (0.25 and 0.4, in log-interval).

**During a run**, the current run is one of the runs like any other, the newest. The only thing special about it is the digit not typed yet: its interval is the time since the last digit, since the player could type it at any moment. The game keeps running the model with it, and the group being typed finishes as soon as the player breaks before the next digit: within the trust horizon, where the usual-break probability (§4.2) says so, so a player with many runs can only cut a group short with a break that outweighs all of them; past it, where this run's own P(break) says so (§3). It never finishes while a mistake shows (§2). All this only decides what the play screen shows: runs record nothing but their timings (§4.4).

### 4.2 Combining runs

The groupings are always computed from **all of the player's stats**, except unchecked runs (played without checking the digits, in developer mode, or from before the game checked them), which may hold mistakes: they're left out unless "Count unchecked runs", in developer mode on the "Your data" page, includes them. There's no overriding: each run's timings just add to the stats, and the groupings follow from them.

- **Recency:** recent runs weigh more, so a player who deliberately regroups some digits sees the game follow. A run's weight is **recency decay** to the power of its age, the newest run counting 1 (0.9 by default: a run about 7 runs back counts half). The weights count in the mixture fit, the usual break spots and the confidence alike.
- **Usual-break probability:** at each place, the recency-weighted average of P(break) over the runs that reached it. The **usual break spots** are the places where it's over ½, and they cut the digits into the player's groups.

All the judging is local to each place in π.

### 4.3 How far the game follows the player

For each place, the model computes a **confidence** that its verdict (usual break or not) is right: the break rate there is treated as unknown, with a Beta(1 + Σw·p, 1 + Σw·(1 − p)) posterior, the sums running over the runs that reached it (w their weight, p their P(break)), and the confidence is the probability that the rate is on the same side of ½ as the verdict. It drops both when fewer runs reach a place and when they disagree there, so it trends down along π, but it's noisy: a threshold on it would cross many times. So the model fits the best non-increasing curve to it, the **confidence trend** (isotonic regression, pooling adjacent violators), which crosses the required **level** exactly once: that's the **trust horizon**. At the default level of 0.9, it takes about three or more recent runs agreeing.

The game follows the player's groups whose break is within the horizon. From the first group that isn't, it plays groups of 5 that grow until the player breaks (§3). For a new player, with no data at all, that's from the very first decimal. The "Your data" page dots the groups past the horizon.

### 4.4 Keeping the data

The raw timings of every run are recorded and **must never be lost**: they're what the player's groupings, and so their constellations, are made of. Like the seed, they're kept in the player data (`architecture.md` §5). A run records each digit typed and when. Backspace leaves no trace: it deletes the last digit's record and takes the clock back to when the digit before it was typed, so the next digit's interval runs from the backspace, as if the player had typed the run without the mistake. Where the player pressed backspace is kept in a separate record (the place of each digit deleted), which groupings don't use: they come from the timings alone. A backspace isn't necessarily a mistake, only that the player thought it was one. Mistakes, and digits typed on after them, are never recorded, but the backspaces deleting them are, at their places, and the clock goes back the same way.

### 4.5 Stats page

A technical page shows the data the groupings come from:

- **Every run, one above the other**, each as a graph of the time per digit against the digit number, with its baseline and **red vertical bars** at its likely breaks (P(break) over ½), the darker the more likely.
- At the bottom, **sticky**, **all runs**: the recency-weighted time per digit, the speed curve, the usual break spots, the confidence trend, and the groups determined from them, which are the ones used during play, dotted past the trust horizon.
- **Sliders for every hyperparameter** of the break model, each with a help button saying what it is, why it works that way and what moving it does to the groups, so they can be tuned against real runs. They're only shown in developer mode, and the values tuned there are tweaks (`glossary.md`).

It's the "Your data" page, opened from the main menu's overflow menu.

### 4.6 Prototype

[`prototypes/groupings-lab.html`](prototypes/groupings-lab.html) is a standalone prototype of the game's first take on groupings (open it in a browser): the play screen with live groups, the stats page with example runs and your own, and sliders for every constant. Its model, a local pace with weighted votes, has since been replaced by the break model (§4.1). It's plain HTML and JavaScript, separate from the app.

## 5. Other layers

- **Constellations** are drawn for the player's own groups, whatever their size; a group of one is a dot.
- **Seasons and milestones** stay counted in digits, independent of groups.

## 6. Open questions

- **Conflicting groups.** What if boundaries from different runs overlap (e.g. 3+4 sometimes, 2+5 other times)?
- **First digits.** The very first digit, and the "3." before the decimals, have no previous digit to time from. A run's first intervals are judged mostly against the prior (§4.1), so a first run much faster or slower than the prior baseline is misjudged at first.
- **Clustered breaks.** If breaks cluster, a two-state hidden Markov model on the residuals could replace the mixture. With hand-labelled data, the probabilities could be calibrated.
- **Sound and colors.** Do they attach to groups, or stay per digit?
- **Stats for players.** Beyond the technical stats page (§4.5), what stats do we show the player, and how?
- **Growing data.** The raw timings (§4.4) grow with play; at some point we may aggregate old stats to save space, to deal with later.
