# Slice of Pi — Personal Digit Groupings

> Status: draft · Ideas from Andrei (2026-10-08), with the decisions taken so far and the questions still open.

## 1. The idea

Instead of imposing fixed groups of five digits (see `vision.md` §5.1), the game **accompanies the player in discovering their own chunking**.

Why:

- When people learn π, groups come to them naturally, and those groups aren't necessarily regular. A player who already knows digits in their own groups shouldn't have to relearn them in exact groups of five.
- Digits often have natural groups that each player can spot: a group of three, a repeated digit, a pattern. Seeing those is personal and up to each player.
- For a beginner, proposing groups may still help them learn, so the game starts with a few slots until the player's own groups are known (§3).

The game detects groupings from **how the player types**: the time it takes them to type each digit. Digits typed quickly one after another belong together; a break between two digits is a boundary. Over runs, the player's typing rhythm reveals their own groups.

**Constellations follow the groupings.** The keypad figures (`vision.md` §5.2) are drawn for the player's own groups rather than for fixed groups of five, which makes them more personal.

## 2. Scope: challenge mode first

The main use case for now is a player who **already knows the digits** and can type them: a challenge mode, not a practice mode. Learn modes come later.

The first version of this mode is **strict**: a mistake (`glossary.md`) blocks the group until the player deletes back to it with backspace, but doesn't end the game. Mistakes are never recorded, so they never reach the timings (§4.4). Other modes, ending the game at a mistake or tolerating a wrong digit now and then, will come later and need their own design.

## 3. Typing a group

The play screen is centred on the group being typed. The typing area shows its **slots**, nothing else: the slots are the group, with no separate hint.

- **Within the trust horizon** (§4.3), the slots are the player's own group at that place, and the group finishes where the player usually breaks, this run included (§4.1): earlier, if they pause long enough mid-group, or later, if they type on fast enough past the slots.
- **Past it**, which for a new player is everywhere, the group starts with a few slots (the **starting slots**, a hyperparameter) and finishes only when the player **breaks** (§4.1). Each digit typed past the slots adds one, never ahead of it, so the player shows the game their groups.
- Groups have **no minimum or maximum size**: a single digit between two breaks is a group of one, and its constellation is a dot.
- A finished group flies off to the **typed digits**, as a word.
- When backspace empties the slots, the last word comes back into them. Backspace takes the clock back to its last digit (§4.4), so the player can carry it on, until they break there again.

## 4. Stats and detected groupings

Every run records the **raw time each digit took to type**, in the spirit of typing-test sites (e.g. the open-source Monkeytype). Groupings are never recorded: they're always derived from the timings, by the break model.

### 4.1 Breaks

A break is a delay that's long **for this player at this place in π**, relative to their current speed. A player types the digits they know best faster than the last ones they know, so a fixed threshold, or one based on their overall speed, would cut the slow end into single digits.

The **break model** (`src/app/timing/break-model.ts`, where its steps and hyperparameters are documented) was translated from a method a data scientist gave us. In short: each interval is compared, in log, with a smooth **baseline** of the run around it; a mixture of two normal distributions, normal intervals and breaks, fitted to those residuals over all runs, gives each interval its **P(break)**. Before the player's runs say enough, the model counts **synthetic runs**, hidden, older than all of the player's and made from best-effort priors, as if the player had played them: so breaks are told from a new player's very first digit. They're just the oldest runs, fading like any run as the player's come, with their own **synthetic decay** between them, so there's no switch from them to the player's data. They're never stored or even made up: the model adds what they would add up to. (A game with many players could take its priors from them.) Every hyperparameter is tuned on the "Your runs" page (§4.5).

During a run, the run being typed is one of the runs like any other. Its next digit, not typed yet, is timed as if typed now, so the group finishes as soon as the player breaks (§3). Only the trust horizon (§4.3) is taken before the run, from the earlier runs, and stays put during it: the run being typed reaches no further than the place being typed, while as the newest run it makes the earlier runs weigh less everywhere, so counting it would drop the confidence just past the player, and the horizon would follow them. This only decides what the play screen shows: runs record nothing but their timings.

### 4.2 Combining runs

The groupings come from **all of the player's runs** (except unchecked ones, unless developer mode counts them, and, while developer mode plays from a line among them, those below it, §4.5), with no overriding: each run just adds to the stats. **Recent runs weigh more**, so a player who deliberately regroups some digits sees the game follow. A place is a **usual break spot** when enough of the recent runs break there, and those spots cut the digits into the player's groups. All the judging is local to each place in π.

### 4.3 How far the game follows the player

At each place, the model computes a **confidence** that its verdict (usual break or not) is right. It drops where fewer runs reach a place and where they disagree, so it trends down along π. Where its trend falls below the required level is the **trust horizon**: the game follows the player's groups up to it, and past it plays growing groups (§3).

### 4.4 Keeping the data

The raw timings of every run **must never be lost** (`architecture.md` §5): the player's groupings, and so their constellations, are made of them. Backspace leaves no trace in them: it deletes the last digit's record and takes the clock back to when the digit before it was typed, as if the player had typed the run without the mistake. Where the player pressed backspace is kept in a separate record, which groupings don't use. A backspace isn't necessarily a mistake, only that the player thought it was one.

### 4.5 Stats page

The "Your runs" page, opened from the main menu's overflow menu, shows what the groupings come from: every run's time per digit with its baseline and likely breaks, and at the bottom, sticky, all runs together with the usual break spots, the confidence trend and the groups used during play, dotted past the trust horizon. In developer mode, it adds a slider for every hyperparameter, each with a help text saying what it is, why it works that way and what moving it does. A long press on a run there also plays from before it: a "You are here" line goes there, and the game, the groups and the chart of all runs only count the runs above it. The runs played meanwhile go just above the line and count, so the game can be replayed from that point on; undoing it puts every run back in the order they were played.

[`prototypes/groupings-lab.html`](prototypes/groupings-lab.html) is the standalone prototype of the game's first take on groupings, whose model the break model has since replaced.

## 5. Other layers

- **Seasons and milestones** stay counted in digits, independent of groups.

## 6. Open questions

- **Conflicting groups.** What if boundaries from different runs overlap (e.g. 3+4 sometimes, 2+5 other times)?
- **First digits.** The very first digit has no previous digit to time from, and a run's first intervals are judged mostly against the priors (§4.1), so a first run much faster or slower than they expect is misjudged at first.
- **Clustered breaks.** If breaks cluster, a two-state hidden Markov model on the residuals could replace the mixture. With hand-labelled data, the probabilities could be calibrated.
- **Sound and colors.** Do they attach to groups, or stay per digit?
- **Stats for players.** Beyond the technical stats page (§4.5), what stats do we show the player, and how?
- **Growing data.** The raw timings (§4.4) grow with play; at some point we may aggregate old stats to save space, to deal with later.
