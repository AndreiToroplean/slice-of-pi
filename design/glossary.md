# Slice of Pi — Glossary

> The words we use for the parts of the game, so docs, code and conversations name things the same way. Rename freely, but update this file when we do.

## π and its digits

- **Digit:** one of the ten values 0 to 9. "The digit 3" is a value, not a position.
- **Place:** a position in π, by its decimal place: place 1 is the 1 right after "3.", and the leading 3 is place 0. Prefer it over "position" or "index".
- **Occurrence:** a place holding a given digit: "the next 3".
- **Group:** consecutive places the player types without a break; among the typed digits, a group is a **word**. Not "chunk" or "packet".
- **Grouping:** how a player splits π into groups.

## Screen

- **Main menu:** the screen the game opens on.
- **Play screen:** where the player types π. Its **pause dialog** resumes, restarts or ends the game.
- **Keypad:** the grid of keys the player types on.
- **Key:** one button of the keypad: a **digit key** or the **backspace key**. "Key 3" is the digit key for 3.
- **Typing area:** where the group being typed appears, as slots to fill.
- **Slot:** an empty space in the typing area waiting for a digit. The number of slots is the **group size**.
- **Typed digits:** the digits typed so far in the run, in words.
- **Background:** the season-colored backdrop behind every screen. Never call it the sky.
- **Season header:** the top of the play screen: the season, and the place in the year on the **year bar**.
- **Sky:** the 3D night sky where the player's constellations collect.

## Play

- **Run:** one attempt, from the start of π until the player stops.
- **Mistake:** a wrong digit. A run whose digits the game doesn't check is **unchecked**.
- **Learn mode / challenge mode:** the two families of modes: guided practice, and typing from memory.
- **Interval:** the time between typing one digit and the next.
- **Baseline:** the interval expected at a place of a run without a break.
- **Break:** an interval clearly longer than its baseline; breaks separate groups. Prefer it over "pause": the player pauses the game.
- **Usual break spot:** a place where the player usually breaks, over their runs.
- **Trust horizon:** how far the game trusts the player's usual break spots, and so follows their groups.
- **Trusted groups:** the player's groups the game follows, those ending within the trust horizon.
- **Synthetic run:** a run the game counts as if the player had played it, before their own runs say enough.
- **Milestone:** a number of places reached that gets celebrated.
- **Streak:** consecutive days the player came back.

## Memory layers

- **Layer** (memory layer): one channel of cues on top of the digits: groups, constellations, colors, seasons, sound, world.
- **Cue:** anything the player can associate with a digit or group to recall it.
- **Constellation:** the figure traced on the keypad by the digits of a group, then placed in the sky.
- **Palette:** the sequence of colors every digit key steps through.
- **Place color:** the color of a place, from the palette.
- **Key color:** the color a digit key shows: the place color of the next occurrence of its digit.
- **Season / year:** 100 places make one year of four seasons.

## Player

- **Seed** (player seed): what makes a player's sky, and anything else unique to them, unique. **Seeded** means derived from it.
- **Player data:** what must never be lost: the seed and the raw timings of every run.

## Developer

- **Developer mode:** a hidden mode for tuning the game.
- **Tweaks:** the values tuned in developer mode, which apply to the game only while it's on.
- **Break model:** how the game tells breaks from the intervals of the runs. Developer mode switches between several, each named after a planet or a moon.
- **Group-size envelope:** a factor from 0 to 1 for each size of group, by which a break model weighs how likely a grouping is: groups of sizes near 0 are rare, and those at 0 never happen. Its **strength** raises every factor to a power, so that it can weigh as much as many runs. At 1 for every size, it changes nothing.
- **Hyperparameter:** a value of a break model set by hand or by a fit, as opposed to what the model works out from the runs (baselines, breaks). A full set of values for a model is a **configuration**.
- **Fit** (hyperparameter search): looking for the configuration whose groups best match the groupings a player gives. The runs it looks at are its **training runs**.
- **F1 score:** how well a model's breaks match the player's, from 0 to 1: 1 when they're the same, lower for each break missed or added.
- **In-sample / out-of-sample:** a configuration's score on its training runs, and on other runs. **Overfitting** is scoring well in-sample only: the configuration fits those runs rather than the player. **Generalization** is how well it keeps its score out of sample.
- **Run-count curve:** a configuration's F1 score against the number of runs it's scored on, each count averaged over random sets of the player's runs. It rises with the count, since a few runs say less. A configuration **carries over** when its curve stays close to the best any configuration reaches at each count; a model is **run-count invariant** when its fitted configurations carry over.
