# Short-term roadmap (draft)

Everything in this folder is a draft: what's in progress and what may come next, not settled design. The lake redesign follows [lake-handoff.md](lake-handoff.md) and its mockup, [lake-play-screen.html](lake-play-screen.html); where they differ, this file wins.

## Lake redesign

### Rules settled since the handoff

- **Units.** Heights and vertical positions are hundredths of the screen's height. Widths and horizontal positions are hundredths of the column's width. The space around a page (its margins, and the corner buttons, snug against them) is a fixed size in rem. It scales only with the browser's zoom. The handoff's values, all in hundredths of the height, need converting.
- **Centering.** The keypad, the slots and the season header are always centered across.
- **Slots.** At most 10 show, in one row: digits typed past them push the first ones left, off the column. Slots are always the same size and the same gap apart. A row of 10 spans exactly the keypad's width.
- **Tuning.** Every tuned value is a developer mode tweak. Copy buttons hand tweaks back as the JSON of a backup file holding them alone.
- **Two editors.** Layout editors are the same in every season. Color editors are per season and come later.

### Done

- Copy buttons copy backup JSON.
- Candy buttons are one component, either clear or solid. Corner buttons are clear candy rounded squares.
- The settings use a segmented control, shared with the tabs on Your Runs.
- Keypad touch areas reach the column's sides and the screen's bottom.
- Touch logs and run replay (not part of the redesign, but they reuse the play screen).
- The layout, a tweak: one set of page margins and one corner button size and rounding for every screen; on the play screen, the header's size, the tape's top, bottom and tile size (tiles have a slot's proportions and rounding), the slots' top, bottom, width, rounding and thickness, and the keypad's top, the top of its touches, and its keys' size, rounding and thickness.
- Edit mode: a handle on each edge the layout sets, showing 10 slots and the touch areas, from the pause dialog in developer mode.

### Next

1. **Background layout.** The lake, beach, tape, hills and trees, night sky and constellation area from the mockup, editable as the handoff describes. Colors come from the season colors for now.
2. **Colors.** Per-season color editors on the play screen, replacing the season colors page.

The "π=3." lead stays, rather than the handoff's "3" with a separator dot.

## Leaderboards in play

The player can tell, as they play, what the leaderboards will make of their run.

### Done

- Known digits are now mastery, to a tenth.
- The play screen shows, under the season header, outside Discovery: the stopwatch, the last split reached and when, the mistakes and the mastery. It stands still while the game is held still, so that a simulation never tells whether the digits tried are right.

### Next

1. **Milestone celebrations.** Each time a run reaches a milestone, a medium celebration: rainbow colors sweeping up the screen's edges, from the bottom to the top, with a short rewarding sound. The first time the player ever reaches it, a bigger one, as for an achievement.
2. **Start from milestones only.** Free play and challenges start from the milestones reached, not from every checkpoint. Discovery keeps moving on to checkpoints every 10 places.
3. **Leaderboards from a milestone.** A menu in the leaderboards page's header picks a milestone for the whole page, back to the start of π on every visit. Every run with digits past it counts, wherever it started, scored only past it: the farthest place reached without a mistake since the milestone, the splits past it, timed from it, and the mastery past it.

### Later

- **Score.** A summary of how well a run went, from its mastery and its timings.
