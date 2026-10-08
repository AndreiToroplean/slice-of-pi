# Slice of Pi — Key and Digit Colors

> Status: draft · Ideas from Andrei (2026-10-08). Terms are defined in [`glossary.md`](glossary.md).

## 1. The idea

Every place in π has a **place color**, derived from the player seed (`vision.md` §5.3). That color should never come as a surprise: the player sees it **before** typing the digit, on the key itself, so that while reaching for 3 they also see the color the next 3 will have. The color becomes part of what they recall: "the next 3 is the green one".

It also follows a broader principle: **the player's actions trigger things** (`vision.md` §3). Seasons change because the player progresses through π; key colors change because the player types.

## 2. How the keypad changes color

- **Keys are filled with color.** A digit key is colored as a whole, not just outlined or tinted.
- **The keypad starts neutral.** At the start of a run every digit key is white, or another neutral color.
- **Press:** the key shows its pressed look, with an effect such as a splash or flash of its color. The typed digit takes the key's current color and keeps it in the typed digits, which are laid out as in the current prototype.
- **Release:** the key takes its **new color**: the place color of the next place in π holding that digit. It keeps that color until the player types that digit again, since that's the only moment the color matters and the only moment it changes.

So at any time, each digit key shows the color the player is about to give that digit, and the keypad as a whole shows the colors of the next occurrence of every digit.

**Consequence.** The first occurrence of each digit in π is typed on a neutral key, so those places are neutral: the leading 3, the first 1, 4, 5, 9, 2, 6, 8 and 7, all by place 13, and the first 0, only at place 32 (places as in [`glossary.md`](glossary.md)). Every later place has a seeded color.

## 3. The seed

- **For now, the seed is a constant in the code**, the same for every player.
- **Later**, each player gets a random seed when they start, kept in their **player data** alongside their timings (`groupings.md`). Players shouldn't have to think about it.
- A menu may offer **"Reset my seed"**, but that button must look clearly dangerous: resetting reshuffles every place color the player has learned.

Everything in `vision.md` §5.3 about keeping the seed and freezing seed-derived output still holds.

## 4. Parked idea: a seed derived from groupings

Instead of a random seed, the colors could be derived from the player's own groupings (`groupings.md`). It's not a seed in the usual sense, though: a random number generator seed is useful precisely because a tiny change to it gives a completely different sequence, whereas colors derived from groupings should change **smoothly**, so that a small change in the player's groupings only shifts their colors a little. It would also make colors move as groupings evolve, which conflicts with stable colors.

We're not pursuing it, but it's recorded here in case we come back to it.

## 5. Open questions

- **Mistakes and backspace.** If the player types a wrong digit (in a lenient mode) or deletes one, what do the keys show? A natural rule: a key always shows the place color of the next occurrence of its digit after the last correctly typed place, so backspace gives a key its previous color back.
- **Free typing.** The current prototype doesn't check digits against π yet. Until it does, the key colors can count how many times each digit has been typed in the run, which matches places in π whenever the player types correctly.
- **Contrast.** The digit label must stay readable on every key color, and colors must stay distinguishable from each other and from the season theme (`vision.md` §5.4).
