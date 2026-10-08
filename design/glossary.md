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
- **Key color:** the color a digit key currently shows, as an **accent**: the place color of the next occurrence of its digit. Keys start **neutral** (white or similar). See `colors.md`.
- **Typing area:** where the group being typed appears, as **slots** to fill.
- **Slot:** an empty space in the typing area waiting for a digit.
- **Hint:** the number of slots, i.e. the size of the group the game expects.
- **Typed digits:** the digits typed so far in the run, shown smaller. In the current prototype, the rows of digits receding to a horizon (the `DigitTape` component, or **tape**).
- **Sky:** the 3D sky of stars where the player's constellations collect.

## Play

- **Run:** one attempt, from the start of π until the player stops or makes a mistake.
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
- **Palette:** the shared sequence of colors, roughly around a color wheel, that every digit key steps through.
- **Place color:** the color of a place, from the palette and how many times its digit came up before it; the same for every player. The first occurrence of each digit is neutral. See `colors.md`.
- **Season / year:** 100 places make one year of four seasons; the theme drifts with them.

## Player

- **Seed** (player seed): the number a player's unique, random-looking but stable output derives from, such as the layout of their sky. Not used for colors. **Seeded** means derived from the seed. For now, a constant shared by every player.
- **Player data:** what must never be lost: the seed and the raw timings of every run.
