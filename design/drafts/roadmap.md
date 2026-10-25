# Short-term roadmap (draft)

Everything in this folder is a draft: what's in progress and what may come next, not settled design. The lake redesign follows [lake-handoff.md](lake-handoff.md) and its mockup, [lake-play-screen.html](lake-play-screen.html); where they differ, this file wins.

## Lake redesign

### Rules settled since the handoff

- **Units.** Heights and vertical positions are hundredths of the screen's height. Widths and horizontal positions are hundredths of the column's width. The space around a page (its margins, the corner buttons' size and insets) is a fixed size in rem. It scales only with the browser's zoom. The handoff's values, all in hundredths of the height, need converting.
- **Centering.** The keypad, the slots and the season header are always centered across.
- **Slots.** We plan for at most 10. Slots are always the same size and the same gap apart. A row of 10 spans exactly the keypad's width.
- **Tuning.** Every tuned value is a developer mode tweak. Copy buttons hand tweaks back as the JSON of a backup file holding them alone.
- **Two editors.** Layout editors are the same in every season. Color editors are per season and come later.

### Done

- Copy buttons copy backup JSON.
- Candy buttons are one component, either clear or solid. Corner buttons are clear candy rounded squares.
- The settings use a segmented control, shared with the tabs on Your Runs.
- Keypad touch areas reach the column's sides and the screen's bottom. A temporary pause menu toggle shows them.
- Touch logs and run replay (not part of the redesign, but they reuse the play screen).
- The layout model: the header, slots and keypad in the units above. The layout is a tweak.

### Next

1. **Edit mode.**
   - In developer mode, an Edit Layout button in the pause dialog puts the play screen in edit mode. No typing while editing. It always shows 10 slots and the touch areas, which replaces the temporary toggle.
   - Each part shows a box. Drag it to move; drag its handle to resize. The parts to edit:
     - the keypad: height, width (the slots follow), and its bottom margin
     - the slots: position, height, and one slot's width, which makes the gaps change instead
     - the season header: position and size
     - the corner buttons and the page margins, which apply to every screen
   - Lock to Play, Copy Values, and a versioned tweak with migrations.
2. **Background layout.** The lake, beach, tape, hills and trees, night sky and constellation area from the mockup, editable as the handoff describes. Colors come from the season colors for now.
3. **Colors.** Per-season color editors on the play screen, replacing the season colors page.

To check with the owner: dropping the "π=3." lead for a "3" with a separator dot (from the handoff).

## Your Data in Settings

Your Data stops being its own page: it becomes a card at the top of Settings. Settings might get a new name.

## Maybe: where touches start

- **Where touches start.** Touch logs would record where each touch went down as well as where it lifted. Replays would draw each touch as a line from the one to the other, with motion showing which way it went. Nothing else would use the new point: runs keep counting only the key a touch typed.
