# Slice of Pi — Design Vision

> Status: draft · Living document — ideas here are directions, not commitments.

## 1. Goal

Build the best game for memorizing the digits of π.

The core bet: **memory sticks better when digits come with extra sensory information.** Instead of a bare stream of numbers, every digit the player types is wrapped in layers of color, shape, sound and atmosphere. Each layer is a pattern on top of the digits that the player can lean on when recalling them — "3, 4, 4, 2… no wait, that was in summer, and we're in winter, so that can't be it."

## 2. Inspiration

The feel we're after is that of the best gamified learning apps: colorful, joyful and almost candy-like, with lots of effects, bouncy transitions and satisfying reactions to every action — the kind of polish that makes an app addictive to come back to — yet built from a simple UI with simple things inside it.

## 3. Design principles

1. **Everything serves memorization.** Every visual, sound or effect should give the player something to associate with a digit or group of digits. If a feature is only decoration, it doesn't belong.
2. **Game-like, but tasteful.** Rewarding feedback, satisfying sounds, milestones — positive reinforcement. But never flashy or noisy to the point of being nauseating. Calm by default, celebratory at the right moments.
3. **Personal and stable.** Parts of the experience are unique to each player (see the seed, §5.3). Once a player has learned with them, they must never change underneath them.
4. **Mobile-first.** The primary target is a phone, in the browser.
5. **Built up incrementally.** The ideas below get implemented little by little; each layer should work on its own.

## 4. Game modes

Two families of modes:

- **Learn modes** — guided, forgiving. The app shows or hints upcoming digits and lets the player build familiarity with them and their associated patterns.
- **Challenge modes** — test yourself. Type from memory and see how far you get.

Exact modes are to be defined.

## 5. Memory layers

Each layer adds an independent "channel" of information on top of the digits.

### 5.1 Five-digit groups (chunking)

Digits are grouped into **packets of 5**. Groups are visually linked as the player types, so π is perceived as a sequence of chunks rather than a flat stream. Most other layers build on this grouping.

Under discussion: letting each player discover their own groups, detected from their typing rhythm, instead of imposing fixed groups of 5. See [`groupings.md`](groupings.md).

### 5.2 Keypad gesture patterns ("constellations")

As the player types a group of 5 digits, the movement of their finger across the keypad traces a path. We draw that path as a **clean geometric figure**:

- Each digit maps to its key position on the keypad. E.g. if 1 is bottom-left and 9 is top-right, typing 1 then 9 draws a diagonal line.
- The figure is structured/idealized — straight lines between key centers — not a literal trace of the finger.
- The 5 points of a group are connected into one symbol.
- When the group is complete, the symbol **lifts off the keypad** and joins the record of the player's progress, so the player can imprint the shape.

**Constellations — going further.** Internally, we categorize these symbols and pattern-match them to recognizable images, the way constellations are named after the figures they resemble. Ideally, when the symbol lifts off the keypad it **morphs** from the abstract geometric shape into a more representational, realistic image that resembles it. This creates a strong association of ideas: the group "is" that image.

### 5.3 Personal digit colors (the player seed)

Each digit position gets a color. The colors are random-looking but **deterministically generated from a seed**, and every player has their own random seed. So one player's 100th digit might be red while another's is yellow.

This makes the color layer a personal memorization aid — and therefore precious:

- **The player must keep their seed.** Losing it scrambles all their colors and makes it very hard to get back on their feet. We need a way to persist, back up and restore it (e.g. show/export the seed, sync to an account).
- **Seed-derived output is frozen once stable.** From a given version onward, the mapping _seed → colors_ (and anything else derived from the seed) must never change. Changing it would effectively wipe or corrupt players' memories.

Implications for development:

- Use our own explicitly specified, versioned PRNG and derivation algorithm — never platform randomness (e.g. `Math.random`) or a library whose output might change.
- Lock the algorithm with golden tests (known seed → known colors for many positions) so any accidental change fails CI.
- If a derivation ever needs to change, it's a new versioned algorithm, and existing players keep the old one.

### 5.4 Seasons

The whole theme of the app changes cyclically as the player advances:

- **100 digits = one year.** Spring → summer → autumn → winter, then repeat.
- The change is **progressive**: the theme drifts continuously through the year rather than switching abruptly every 25 digits.
- The season becomes a cue for position: "I remember 3442 being in summer, but we're in winter, so it must be something else."

### 5.5 Sound

Digits (and/or groups, milestones, seasons) have associated sounds, adding an auditory channel to the other cues. Details to be designed.

### 5.6 World and character (later)

A character evolves through an environment as the player advances, adding **geography** as another memorization layer: where you were in the world tells you where you are in π. For example, the character could walk through a procedurally generated city and encounter things along the way, and typing the next 10 digits correctly could beat a boss.

This would bring simple 2D graphics into the game, in the same candy-like style. The direction isn't decided yet, but the architecture should leave room for it.

## 6. Game feel and rewards

- **Milestones** reward progress with a satisfying sound and a short, tasteful visual moment.
- Milestones should get sparser as the player goes further — roughly logarithmic. A candidate scale is 10, 20, 50, 100, 200, 500, 1000, … (exact values to be decided).
- **Streaks** encourage coming back regularly.
- Positive reinforcement throughout: correct digits feel good, errors are clear but not punishing in learn modes.
