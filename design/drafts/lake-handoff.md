# Lake play screen and the Edit Layout editor: handoff (draft)

This is a brief for a Claude session in VS Code that implements the new play screen layout in Slice of Pi, and a developer mode editor to tune it. It sums up what Andrei and Claude settled in the "Home screen redesign" thread of the project (2026-10-19 to 2026-10-24). The reference is the mockup next to this file, [lake-play-screen.html](lake-play-screen.html) (open it in a browser; the same page is published at https://claude.ai/artifact/12LGehLEdYtfvDH8LxW7Tc). Read the repo's CLAUDE.md and `design/` first; everything there still applies (Conventional Commits, `npm run check`, tests with every feature, tuning through developer mode pages and tweaks, no commercial names).

## Where the discussion landed

- The game's look is a kid's electronic toy and a board game: opaque plastic, rounded rectangles (never circular buttons), little transparency, flat 2D (no 3D, no complex lighting).
- The sky is a real night sky. Constellations live in it.
- The name is only a pun: don't force pie or sweets into the story or the art.
- The lead "π=3." goes away: a "3" with a dot that reads as a separator starts the typed digits. (Offered as its own PR; not confirmed yet, so check with Andrei before doing it.)
- A geography, map or character stays a wild idea (`design/wild-ideas.md`), not part of this work.

## The play screen

From the bottom of the screen up:

- **Lake** (from 0 to `lake`% of the height): it mirrors the sky's colors (night colors with the season's glow near the shore), with faint star reflections and horizontal, stretched ripples.
- **Keypad** floating on the lake, with no card or panel behind it: the existing candy buttons (`.candy` in `src/styles.css`), each digit key in exactly its key color from the place colors (as the game already colors them). Same 7 8 9 / 4 5 6 / 1 2 3 / _ 0 ⌫ layout.
- **Slots**, one row, also floating on the lake: as many as the group size, with a hard cap of 10.
- **Beach**: a sand strip whose top edge is a little hilly (a curve), with a darker wet line where it meets the water.
- **Tape**: the typed digits on a single row on the beach (word tiles, as now), scrolled to the latest.
- **Hills**: two hills (back and front), season colored, each with its own small simple trees (a trunk and a rounded rectangle crown; bare in winter).
- **Night sky** above: stars, the season header (season name with its icon, year and place, the four season progress bars), and one area where the constellations appear. The game generates the constellations; the layout only says where they may go.
- **Corner buttons**: the pause button in the top right.

## The layout values

Andrei tuned these in the mockup (his values, converted to the mockup's final format). Use them as the game's defaults:

```json
{
  "lake": 44.2,
  "beach": [
    { "x": 0, "y": 46.9 },
    { "x": 25, "y": 46.2 },
    { "x": 50, "y": 46.7 },
    { "x": 75, "y": 46.1 },
    { "x": 100, "y": 46.8 }
  ],
  "hills": [
    [
      { "x": 0, "y": 51.6 },
      { "x": 16.7, "y": 50.9 },
      { "x": 33.3, "y": 52.9 },
      { "x": 50, "y": 55.6 },
      { "x": 66.7, "y": 56.2 },
      { "x": 83.3, "y": 54.2 },
      { "x": 100, "y": 51.6 }
    ],
    [
      { "x": 0, "y": 50.9 },
      { "x": 16.7, "y": 53.7 },
      { "x": 33.3, "y": 54.1 },
      { "x": 50, "y": 48.5 },
      { "x": 66.7, "y": 48 },
      { "x": 83.3, "y": 50.8 },
      { "x": 100, "y": 50.9 }
    ]
  ],
  "trees": [
    { "hill": 1, "x": 13.5, "s": 11.4 },
    { "hill": 1, "x": 85.2, "s": 8.8 }
  ],
  "keys": { "bottom": 0.7, "w": 49, "h": 34.6, "gap": 1.4 },
  "slots": { "bottom": 36.3, "w": 66.7, "h": 7, "gap": 0.8 },
  "tape": { "bottom": 45.2, "h": 4.4 },
  "header": { "bottom": 87, "w": 32, "h": 10 },
  "corner": { "top": 4, "side": 3.4, "s": 5.5 },
  "stars": { "x": 36, "bottom": 61.5, "w": 48, "h": 20 },
  "groupSize": 5
}
```

How to read them:

- Vertical positions (`bottom`, `lake`, a point's `y`) and heights (`h`) are percentages of the screen's height, measured from its bottom.
- Sizes of things that keep their shape are percentages of the height too: the width `w` of the keypad, slots and header, gaps, a tree's size `s`, and the corner button's size `s` and insets `top` and `side`. So the layout scales with the screen's height; on a narrow screen a centered box's width is capped to the screen's width minus a margin.
- Horizontal positions (a point's or tree's `x`, the constellation area's `x` and `w`) are percentages of the width, so curves and trees stretch with the screen.
- The keypad, the slots and the season header are always centered horizontally: they have no x.
- `beach` and each of `hills` (back first) are control points from left to right; the first and last stay at x 0 and 100. The lines are smooth curves through them (the mockup uses Catmull-Rom).
- A tree stands on its hill (`hill` is its index in `hills`) at `x`: its foot follows the hill's curve.
- `groupSize` is only the mockup's preview of the slot count; the game's group size comes from the grouping, as now.

### Corner buttons

A corner button is saved as its size and its distance from the screen's top and from its side (`corner.top`, `corner.side`, `corner.s`). The same rule and values apply to every button in a corner of any screen: the pause button (top right, distance from the right), the main menu's overflow button ⋮ (top right) and a settings button (top left, measured from the left). So editing one moves them all.

## The Edit Layout editor (developer mode)

In developer mode, the pause dialog gets an **Edit Layout** button. It closes the dialog and puts the play screen in edit mode, with the same editors as the mockup. The layout is a tweak (like the key and season colors): saved in IndexedDB, applied while developer mode is on, and handed back with a copy button so the values can go into the code.

What the mockup does, which the game should match:

- **Bounding boxes**: every element shows a dashed box with a small label: corner buttons, season header, each tree, slots, keypad, tape, constellation area, lake line. Curves (hills, beach) show no box until selected, to keep the screen readable.
- **Focus**: tap a thing to select it; only the selected thing shows its controls (a resize handle at its bottom right corner, or its control points). Tapping the same spot again, without moving, selects what lies under it (that's how to reach the beach under the tape, for example). Tapping empty space deselects.
- **An inspector row** names the selected thing and shows its actions, plus Done.
- **Moving and resizing**:
  - Keypad, slots, header: drag moves them vertically only (they stay centered); the handle changes width and height.
  - Tape: drag moves it; the handle changes its height (it always spans the screen).
  - Corner buttons: drag moves the inset from the top and the side; the handle resizes it from its outer corner. A ghost box shows that the left corners follow.
  - Constellation area: drag moves it; the handle resizes it.
  - Lake: drag its line up and down.
  - Tree: drag moves it along the hills; it lands on whichever hill's slope is nearest the finger, so trees move from one hill to the other. The handle resizes it. **Remove Tree** deletes it.
  - Hills and beach: dragging the shape moves all its points up and down. Each control point drags on its own (inner points between their neighbours; the end points only vertically). **Add Point** adds one in the widest gap; **Remove Point** removes the picked inner point. For a hill, **Add Tree** puts a new tree on it.
- **Lock to Play** hides the editor so the keypad can be used to type and see the layout with real digits.
- **Copy Values** copies the JSON above (a fallback text box shows it if the clipboard is refused).
- The mockup also has a season switch, a group size stepper and a width slider to check the layout on narrower screens; in the game, the real season, group and screen do that.

## Notes for the implementation

- The mockup is a single file with plain JS; take its behaviour, not its code. In the game, split it into small components (the scene drawing, each element, the editor overlay) and keep the layout values in one typed model with defaults in the code and the tweak on top.
- Test the layout math (percent conversions, centering and capping, corner insets on both sides, curve sampling and a tree's height on its hill, adding and removing points and trees) with unit tests; leave drag gestures and the dialog flow to a few end-to-end tests at most.
- Keep the stored tweak format versioned, with a migration whenever it changes, as the existing tweaks do.
- Ask Andrei to check it on his phone with a PR preview (CLAUDE.md says how).
