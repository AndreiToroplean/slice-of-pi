# Slice of Pi — Glossary

> Status: draft · The words we use for the parts of the game, so docs, code and conversations name things the same way. Proposed 2026-10-08; rename freely, but update this file when we do.

## π and its digits

- **Digit:** one of the ten values 0 to 9. "The digit 3" is a value, not a position.
- **Place:** a position in π, numbered by its decimal place: place 1 is the 1 right after "3.", place 2 is the 4, and so on. The leading 3 is **place 0**. So "place 100" is the 100th decimal. Prefer "place" over "position" or "index" for this.
- **Occurrence:** a place holding a given digit. "The next 3" is the next occurrence of the digit 3.
- **Group:** consecutive places the player types without a break; a group shown among the typed digits is laid out like a **word**. Replaces "chunk" or "packet". See `groupings.md`.
- **Grouping:** how a player splits π into groups, detected from their timings.

## Screen

- **Keypad:** the grid of keys the player types on (`7 8 9 / 4 5 6 / 1 2 3 / _ 0 ⌫`).
- **Key:** one button of the keypad: a **digit key** (0 to 9) or the **backspace key** (⌫). "Key 3" is the digit key for 3.
- **Key color:** the color a digit key currently shows: the place color of the next occurrence of its digit. See `colors.md`.
- **Typing area:** where the group being typed appears, as **slots** to fill.
- **Slot:** an empty space in the typing area waiting for a digit.
- **Hint:** the number of slots, i.e. the size of the group the game expects.
- **Typed digits:** the digits typed so far in the run, shown smaller above the typing area: after a "3." lead, each finished group is a **word** of joined tiles, and rows wrap between words like text (the `TypedDigits` component).
- **Background:** the season-colored gradient behind the whole play screen. Never call it the sky.
- **Season header:** the top of the play screen: the season's icon and name, the year and place in it ("Year 1 · digit 42 of 100"), and the **year bar**, one part per season.
- **Sky:** the 3D night sky of stars where the player's constellations collect. Only this, never the background.

## Play

- **Run:** one attempt, from the start of π until the player stops or makes a mistake. Until the game checks the digits, a run ends when the player deletes every digit typed, or leaves the game.
- **Learn mode / challenge mode:** the two families of modes: guided practice, and typing from memory.
- **Interval:** the time between typing one digit and the next.
- **Pace:** the player's local typing speed around a place, from the intervals around it.
- **Break:** an interval clearly longer than the local pace; breaks separate groups. Prefer "break" over "pause" in technical text.
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
