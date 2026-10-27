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

To check with the owner: dropping the "π=3." lead for a "3" with a separator dot (from the handoff).
