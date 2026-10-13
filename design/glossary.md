# Slice of Pi — Glossary

> Status: draft · The words we use for the parts of the game, so docs, code and conversations name things the same way. Proposed 2026-10-08; rename freely, but update this file when we do.

## π and its digits

- **Digit:** one of the ten values 0 to 9. "The digit 3" is a value, not a position.
- **Place:** a position in π, numbered by its decimal place: place 1 is the 1 right after "3.", place 2 is the 4, and so on. The leading 3 is **place 0**. So "place 100" is the 100th decimal. Prefer "place" over "position" or "index" for this.
- **Occurrence:** a place holding a given digit. "The next 3" is the next occurrence of the digit 3.
- **Group:** consecutive places the player types without a break; a group shown among the typed digits is laid out like a **word**. Replaces "chunk" or "packet". See `groupings.md`.
- **Grouping:** how a player splits π into groups, detected from their timings.

## Screen

- **Main menu:** the screen the app opens on: the game's icon and name, and Play.
- **Play screen:** where the player types π. Its **pause button** opens the **pause dialog**: resume, restart (a new run) or end the game, back to the main menu.
- **Keypad:** the grid of keys the player types on (`7 8 9 / 4 5 6 / 1 2 3 / _ 0 ⌫`).
- **Key:** one button of the keypad: a **digit key** (0 to 9) or the **backspace key** (⌫). "Key 3" is the digit key for 3.
- **Key color:** the color a digit key currently shows: the place color of the next occurrence of its digit. See `colors.md`.
- **Typing area:** where the group being typed appears, as **slots** to fill.
- **Slot:** an empty space in the typing area waiting for a digit.
- **Group size:** the number of slots, which is the size of the group being typed (`groupings.md` §3).
- **Trusted groups:** the detected groups the game follows, those ending within the trust horizon.
- **Typed digits:** the digits typed so far in the run, shown smaller above the typing area: after a "3." lead, each finished group is a **word** of joined tiles, and rows wrap between words like text (the `TypedDigits` component).
- **Background:** the season-colored gradient behind every screen; it stays in place from screen to screen. Never call it the sky.
- **Season header:** the top of the play screen: the season's icon and name, the year and place in it ("Year 1 · digit 42 of 100"), and the **year bar**, one part per season.
- **Sky:** the 3D night sky of stars where the player's constellations collect. Only this, never the background.

## Play

- **Run:** one attempt, from the start of π until the player stops. For now a mistake doesn't end it (`groupings.md` §2): a run ends when the player restarts or ends the game, or leaves it; deleting every digit typed deletes the run.
- **Synthetic run:** a run the break model counts as if the player had played it, before their own runs say enough; never shown (`groupings.md` §4.1).
- **Mistake:** a wrong digit, checked against the decimals of π the game knows (`src/app/pi/`). It shows in its slot as a red digit outlined in red on almost white, as does every digit typed on after it, until the player deletes back to it (`groupings.md` §2). Runs played with checking turned off, in developer mode, are **unchecked**.
- **Learn mode / challenge mode:** the two families of modes: guided practice, and typing from memory.
- **Interval:** the time between typing one digit and the next.
- **Baseline:** the interval expected at a place of a run without a break, from a rolling median of the run's intervals (`groupings.md` §4.1).
- **Break:** an interval clearly longer than its baseline; breaks separate groups. The break model gives each interval a probability of being one, P(break). Prefer "break" over "pause" in technical text: "pause" is the player pausing the game.
- **Usual break spot:** a place where the player usually breaks, over all their runs (`groupings.md` §4.2).
- **Trust horizon:** the place up to which the game trusts the player's usual break spots, and so follows their groups (`groupings.md` §4.3).
- **Milestone:** a number of places reached that gets celebrated (10, 20, 50, 100, …).
- **Streak:** consecutive days the player came back.

## Memory layers

- **Layer** (memory layer): one channel of cues on top of the digits: groups, constellations, colors, seasons, sound, world.
- **Cue:** anything the player can associate with a digit or group to recall it.
- **Constellation:** the figure traced on the keypad by the digits of a group, then placed in the sky.
- **Palette:** the sequence of colors every digit key steps through.
- **Place color:** the color of a place, from the palette. See `colors.md`.
- **Season / year:** 100 places make one year of four seasons; the theme drifts with them.

## Player

- **Seed** (player seed): what makes a player's sky, and anything else unique to them, unique. **Seeded** means derived from the seed. See `vision.md` §7.
- **Player data:** what must never be lost: the seed and the raw timings of every run.

## Developer

- **Developer mode:** a hidden mode for tuning the game, turned on and off by tapping the main menu's game icon ten times in a row (`developer-taps.ts`). It adds a Developer section to the ⋮ menu, with a page per thing to tune and a "Check Digits" toggle.
- **Tweaks:** values tuned in developer mode, such as the key colors or the grouping settings, and developer settings such as checking the digits. They're kept with the player data and apply to the game only while developer mode is on. Each page's "Copy hyperparameter values" button copies them as text, to be written into the code.
