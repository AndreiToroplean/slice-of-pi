# Slice of Pi — Key and Digit Colors

> Status: draft · Ideas from Andrei (2026-10-08). Terms are defined in [`glossary.md`](glossary.md).

## 1. The idea

Every place in π has a **place color**. That color should never come as a surprise: the player sees it **before** typing the digit, on the key itself, so that while reaching for 3 they also see the color the next 3 will have. The color becomes part of what they recall: "the next 3 is the green one".

It also follows a broader principle: **the player's actions trigger things** (`vision.md` §3). Seasons change because the player progresses through π; key colors change because the player types.

## 2. Colors come from π

There's no seed and no random number generator behind key colors: **π's own digits drive them**.

- There's one **palette**: a sequence of colors, roughly going around a color wheel.
- Every digit key steps through that same palette, in the same order: each time its digit comes up, the key moves on to the next color. When it reaches the end of the palette, it starts over.
- Every key starts **neutral** (white or similar), so the first occurrence of each digit is neutral: the first 1, 4, 5, 9, 2, 6, 3, 8 and 7, all by place 13, and the first 0, only at place 32. Neutral never comes back after that.
- **Only the decimals count**, since they're what the player types: the leading 3 has no color and doesn't use up a step of key 3.

So the color of a place depends on how many times its digit has come up before it. Since each digit makes up about a tenth of π, the keys move through the palette **roughly in sync**: the whole keypad drifts around the color wheel as the player advances, with a key running a little ahead or behind when its digit has come up more or less often lately. That's a feature, not something to design around.

**Shared colors are a feature too.** Every player sees the same colors, so players can talk about "the blue 7 around place 150", and someone playing on another player's phone still finds their colors.

The palette has **10 colors**: solid colors around the color wheel that carry white digits well (the yellow less so, which is fine). The current pick is in the prototype (`prototypes/groupings-lab.html`) and can still be tuned to look nice, especially next to one another. Like everything players learn with, the palette is frozen once stable (`vision.md` §3).

## 3. How keys show their color

- **Accent at rest.** A key shows its color as an **accent**, not as a full fill, which would be overwhelming and not nice to look at. In the prototype, the accent is a band across the bottom of the key.
- **Press:** the key shows its pressed look and **fills completely** with its solid color, **all at once**: no transition and no glow, so it makes an impression. The typed digit takes that color and keeps it: in the slots and in the typed digits, it's shown in white on its color.
- **Release:** the key switches to its **new accent**: the color of the next occurrence of its digit. It keeps that accent until the player types that digit again, since that's the only moment the color matters and the only moment it changes.

So at any time, each digit key shows the color the player is about to give that digit. The exact look of the accent and of the splash is for a prototype.

## 4. Parked ideas

We're not pursuing these, but they're recorded in case we come back to them.

- **Seeded key colors.** Each place gets a random color derived from the player seed (`vision.md` §7), so every player has their own colors. Dropped because it makes colors something the player can lose, and players couldn't share them.
- **Colors derived from groupings.** Derive colors from the player's own groupings (`groupings.md`) instead of a random seed. That isn't a seed in the usual sense, though: a random number generator seed is useful precisely because a tiny change to it gives a completely different sequence, whereas colors derived from groupings should change **smoothly**, so that a small change in the player's groupings only shifts their colors a little. It would also make colors move as groupings evolve, which conflicts with stable colors.

## 5. Open questions

- **Mistakes and backspace.** If the player types a wrong digit (in a lenient mode) or deletes one, what do the keys show? A natural rule: a key always shows the color of the next occurrence of its digit after the last correctly typed place, so backspace gives a key its previous color back.
- **Free typing.** The current prototype doesn't check digits against π yet. Until it does, keys can count how many times their digit has been typed in the run, which matches π whenever the player types correctly.
- **Contrast.** The digit label must stay readable with every accent and fill, and the colors must stay distinguishable from the season theme (`vision.md` §5.4).
