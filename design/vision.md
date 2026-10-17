# Slice of Pi — Design Vision

> Ideas here are directions, not commitments.

## 1. Goal

Build the best game for memorizing the digits of π.

What the game means, and why it's called Slice of Pi, is in [`meaning.md`](meaning.md).

The core bet: **memory sticks better when digits come with extra sensory information.** Instead of a bare stream of numbers, every digit the player types is wrapped in layers of color, shape, sound and atmosphere. Each layer is a pattern on top of the digits that the player can lean on when recalling them — "3, 4, 4, 2… no wait, that was in summer, and we're in winter, so that can't be it."

## 2. Inspiration

The feel we're after is that of the best gamified learning apps: colorful, joyful and almost candy-like, with lots of effects, bouncy transitions and satisfying reactions to every action — the kind of polish that makes an app addictive to come back to — yet built from a simple UI with simple things inside it.

## 3. Design principles

1. **Everything serves memorization.** Every visual, sound or effect should give the player something to associate with a digit or group of digits. If a feature is only decoration, it doesn't belong.
2. **Game-like, but tasteful.** Rewarding feedback, satisfying sounds, milestones — positive reinforcement. But never flashy or noisy to the point of being nauseating. Calm by default, celebratory at the right moments.
3. **Personal and stable.** Parts of the experience are unique to each player (see the seed, §7). Once a player has learned with something, it must never change underneath them: anything derived (place colors, the sky, …) is frozen once stable, and only ever changed through a new versioned algorithm that existing players don't get.
4. **Mobile-first.** The primary target is a phone, in the browser.
5. **Built up incrementally.** The ideas below get implemented little by little; each layer should work on its own.
6. **Actions trigger things.** What changes on screen should feel caused by the player: seasons turn because they progress through π, key colors change because they type.

## 4. Game modes

Two families of modes:

- **Learn modes** — guided, forgiving. The app shows or hints upcoming digits and lets the player build familiarity with them and their associated patterns.
- **Challenge modes** — test yourself. Type from memory and see how far you get.

The exact modes are open.

## 5. Memory layers

Each layer adds an independent "channel" of information on top of the digits.

### 5.1 Groups (chunking)

Digits are typed and shown in **groups**, so π is perceived as a sequence of chunks rather than a flat stream. Each player discovers their own groups, detected from their typing rhythm. Most other layers build on them.

### 5.2 Keypad gesture patterns ("constellations")

As the player types a group, the movement of their finger across the keypad traces a path. We draw that path as a **clean geometric figure**:

- Each digit maps to its key position on the keypad. E.g. if 1 is bottom-left and 9 is top-right, typing 1 then 9 draws a diagonal line.
- The figure is structured/idealized — straight lines between key centers — not a literal trace of the finger.
- The points of a group are connected into one symbol.
- When the group is complete, the symbol **lifts off the keypad** and joins the record of the player's progress, so the player can imprint the shape.

**Constellations — going further.** Internally, we categorize these symbols and pattern-match them to recognizable images, the way constellations are named after the figures they resemble. Ideally, when the symbol lifts off the keypad it **morphs** from the abstract geometric shape into a more representational, realistic image that resembles it. This creates a strong association of ideas: the group "is" that image.

**Your sky.** The figure is drawn on top of the keypad as the player types the group. When the group is complete, it flies away into a **sky of realistic stars**, where it joins the constellations of the groups before it:

- Each new constellation is placed next to the previous ones in a random direction, but roughly towards the right, so the sky reads in order like a line of text.
- Constellations have different sizes: some are drawn bigger than others, again with some randomness.
- The sky is **3D**: the camera rotates to bring the new constellation into view, zooming in on small ones and out on big ones.
- The randomness (placement, size, and anything else about the sky) comes from the **player seed** (§7), so it's stable and unique to each player: it's _their_ sky.
- The player can **open their sky** at any time just to look at their constellations and admire them, in 3D.
- Players could also **share their sky** with other people.

### 5.3 Digit colors

Each place in π gets a color, shown on its key before the player types it. The colors come from π itself, not from the seed, so they're the same for every player.

Parked ideas:

- **Seeded colors**, from the player seed (§7): every player would have their own colors, but they could lose them, and players couldn't share them.
- **Colors from the player's groupings.** They would have to change smoothly with the groupings, which a seed doesn't, and they'd move as the groupings evolve, which conflicts with stable colors.

### 5.4 Seasons

The whole theme of the app changes cyclically as the player advances:

- **100 digits = one year.** Spring → summer → autumn → winter, then repeat.
- The change is **progressive**: the theme drifts continuously through the year rather than switching abruptly every 25 digits.
- The season becomes a cue for position: "I remember 3442 being in summer, but we're in winter, so it must be something else."

### 5.5 Sound

Digits (and/or groups, milestones, seasons) have associated sounds, adding an auditory channel to the other cues. How exactly is open.

### 5.6 World and character

A character evolves through an environment as the player advances, adding **geography** as another memorization layer: where you were in the world tells you where you are in π. For example, the character could walk through a procedurally generated city and encounter things along the way, and typing the next 10 digits correctly could beat a boss. It would bring simple 2D graphics into the game, in the same candy-like style. The direction isn't decided.

## 6. Game feel and rewards

- **Milestones** reward progress with a satisfying sound and a short, tasteful visual moment.
- Milestones should get sparser as the player goes further — roughly logarithmic, for example 10, 20, 50, 100, 200, 500, 1000, … (the exact scale is open).
- **Streaks** encourage coming back regularly.
- Positive reinforcement throughout: correct digits feel good, errors are clear but not punishing in learn modes.

## 7. The player seed

Some things are unique to each player, starting with the layout of their sky (§5.2), the way a seed makes a generated world unique. Their randomness is **deterministically generated from the player seed**.

- Each player gets a random seed when they start, kept in their player data. Players shouldn't have to think about it, but they must never lose it: losing it reshuffles everything derived from it.
- A menu may offer **"Reset my seed"**, but that button must look clearly dangerous.
- Seed-derived output is stable (§3). It comes from our own versioned random number generator, never one whose output might change.

## 8. Wild ideas

Ideas to pick from someday.

- **Digitless mode.** The digits don't show anywhere: no labels on the keys, no typed digits, only colors, constellations, seasons and sounds. The player learns π without ever seeing it, like a game of repeating sequences of lights and sounds (`meaning.md` §3).
- **Start anywhere.** The player picks where in π to start, for example 100 digits from the millionth place on, and learns that slice (`meaning.md` §2).
