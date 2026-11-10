import { LAYOUT } from '../../../ui/layout';
import { dragged, stepped, UnitSizes } from '../../../ui/handles/handle';
import { LAYOUT_HANDLES, LayoutHandle } from './layout-handles';

/** A rem of 16 pixels, a screen 800 pixels tall and a column 400 wide. */
const SIZES: UnitSizes = { rem: 16, height: 8, column: 4 };

function handle(label: string): LayoutHandle {
  const found = LAYOUT_HANDLES.find((each) => each.label === label);
  if (found === undefined) {
    throw new Error(`No handle ${label}`);
  }
  return found;
}

describe('layout handles', () => {
  it('follows the finger: a handle moves as far as it’s dragged, in its value’s unit', () => {
    expect(dragged(handle('Top margin'), LAYOUT, 16, SIZES).margins.top).toBe(
      LAYOUT.margins.top + 1,
    );
    expect(dragged(handle('Corner size'), LAYOUT, -8, SIZES).corner.size).toBe(
      LAYOUT.corner.size - 0.5,
    );
    expect(dragged(handle('Slot width'), LAYOUT, 4, SIZES).slots.width).toBe(
      LAYOUT.slots.width + 1,
    );
  });

  it('raises what’s measured up from the bottom when dragged up', () => {
    expect(dragged(handle('Keypad top'), LAYOUT, -40, SIZES).keypad.top).toBe(
      LAYOUT.keypad.top + 5,
    );
    expect(dragged(handle('Bottom margin'), LAYOUT, 16, SIZES).margins.bottom).toBe(
      LAYOUT.margins.bottom - 1,
    );
  });

  it('grows the tiles by twice as much as their top edge moves, as they stay across the tape’s middle', () => {
    expect(dragged(handle('Tiles'), LAYOUT, -8, SIZES).tape.words).toBe(LAYOUT.tape.words + 2);
  });

  it('rounds each value to the finest step of its unit', () => {
    // 3 pixels: 0.375 hundredths of the height, 0.1875 rem.
    const at = {
      ...LAYOUT,
      keypad: { ...LAYOUT.keypad, top: 35 },
      margins: { ...LAYOUT.margins, side: 1 },
    };
    expect(dragged(handle('Keypad top'), at, -3, SIZES).keypad.top).toBe(35.4);
    expect(dragged(handle('Side margins'), at, 3, SIZES).margins.side).toBe(1.1875);
  });

  it('keeps every value on the screen, and each top above its bottom', () => {
    expect(dragged(handle('Top margin'), LAYOUT, -1000, SIZES).margins.top).toBe(0);
    expect(dragged(handle('Keypad top'), LAYOUT, -10000, SIZES).keypad.top).toBe(100);
    expect(dragged(handle('Tape top'), LAYOUT, 1000, SIZES).tape.top).toBe(LAYOUT.tape.bottom);
    expect(dragged(handle('Slot width'), LAYOUT, 1000, SIZES).slots.width).toBe(10);
  });

  it('moves a part by its bottom, its top along with it, keeping it on the screen', () => {
    const height = LAYOUT.slots.top - LAYOUT.slots.bottom;
    expect(dragged(handle('Slots bottom'), LAYOUT, -8, SIZES).slots).toEqual({
      ...LAYOUT.slots,
      bottom: LAYOUT.slots.bottom + 1,
      top: LAYOUT.slots.top + 1,
    });
    expect(dragged(handle('Slots bottom'), LAYOUT, -10000, SIZES).slots.top).toBe(100);
    expect(dragged(handle('Slots bottom'), LAYOUT, -10000, SIZES).slots.bottom).toBe(100 - height);
    expect(dragged(handle('Tape bottom'), LAYOUT, 8, SIZES).tape).toEqual({
      ...LAYOUT.tape,
      bottom: LAYOUT.tape.bottom - 1,
      top: LAYOUT.tape.top - 1,
    });
  });

  it('raises the keypad’s top with the bottom margin, keeping the keypad as tall', () => {
    // 1 rem up is 2 hundredths of the screen's height, 16 pixels.
    expect(dragged(handle('Bottom margin'), LAYOUT, -16, SIZES)).toEqual({
      ...LAYOUT,
      margins: { ...LAYOUT.margins, bottom: LAYOUT.margins.bottom + 1 },
      keypad: { ...LAYOUT.keypad, top: LAYOUT.keypad.top + 2 },
    });
  });

  it('steps a value by the finest step of its unit, up or down', () => {
    const at = {
      ...LAYOUT,
      keypad: { ...LAYOUT.keypad, top: 35 },
      corner: { ...LAYOUT.corner, size: 2.75 },
    };
    expect(stepped(handle('Keypad top'), at, 1, SIZES).keypad.top).toBe(35.1);
    expect(stepped(handle('Corner size'), at, -10, SIZES).corner.size).toBe(2.125);
  });

  it('keeps each rounding within half of what it rounds, shrinking it along with that', () => {
    expect(dragged(handle('Key radius'), LAYOUT, 1000, SIZES).keypad.keyRadius).toBe(
      LAYOUT.keypad.keyHeight / 2,
    );
    expect(dragged(handle('Slot radius'), LAYOUT, 1000, SIZES).slots.radius).toBe(
      (LAYOUT.slots.top - LAYOUT.slots.bottom) / 2,
    );
    expect(dragged(handle('Corner size'), LAYOUT, -1000, SIZES).corner).toEqual({
      size: 1,
      radius: 0.5,
    });
    const short = dragged(handle('Key height'), LAYOUT, -1000, SIZES).keypad;
    expect(short.keyHeight).toBe(1);
    expect(short.keyRadius).toBe(0.5);
  });

  it('thickens the slots as their face’s bottom is raised, and the keys as theirs is lowered', () => {
    expect(dragged(handle('Slot depth'), LAYOUT, -8, SIZES).slots.depth).toBe(
      LAYOUT.slots.depth + 1,
    );
    expect(dragged(handle('Key depth'), LAYOUT, 8, SIZES).keypad.keyDepth).toBe(
      LAYOUT.keypad.keyDepth + 1,
    );
    expect(dragged(handle('Key depth'), LAYOUT, -1000, SIZES).keypad.keyDepth).toBe(0);
  });

  it('sizes the keys within the keypad', () => {
    expect(dragged(handle('Key width'), LAYOUT, -4, SIZES).keypad.keyWidth).toBe(
      LAYOUT.keypad.keyWidth - 1,
    );
    expect(dragged(handle('Key height'), LAYOUT, 4, SIZES).keypad.keyHeight).toBe(
      LAYOUT.keypad.keyHeight + 0.5,
    );
  });

  it('raises the top of the keys’ touches above the keypad’s top, never below it', () => {
    expect(dragged(handle('Touch top'), LAYOUT, -8, SIZES).keypad.reach).toBe(
      LAYOUT.keypad.reach + 1,
    );
    expect(dragged(handle('Touch top'), LAYOUT, 1000, SIZES).keypad.reach).toBe(0);
  });

  it('changes only the value of the handle', () => {
    for (const each of LAYOUT_HANDLES) {
      const changed = stepped(each, LAYOUT, -1, SIZES);
      expect(each.set(changed, each.get(LAYOUT), SIZES)).toEqual(LAYOUT);
    }
  });

  it('stops the keys growing taller once their rows touch', () => {
    // The keypad's top, less the bottom margin, in heights: 1.75 rem is 3.5 heights here.
    const tall = dragged(handle('Key height'), LAYOUT, 1000, SIZES).keypad;
    expect(tall.keyHeight).toBeCloseTo((LAYOUT.keypad.top - 3.5) / 4);
  });

  it('stops the keys growing wider once the three of a row touch', () => {
    // The column, less the side margins: 1.25 rem is 5 hundredths of the column here.
    const wide = dragged(handle('Key width'), LAYOUT, 1000, SIZES).keypad;
    expect(wide.keyWidth).toBeCloseTo((100 - 2 * 5) / 3);
  });

  it('stops the keypad shrinking once its four rows of keys touch', () => {
    const low = dragged(handle('Keypad top'), LAYOUT, 1000, SIZES).keypad;
    expect(low.top).toBeCloseTo(3.5 + 4 * LAYOUT.keypad.keyHeight);
  });

  it('never moves a key’s size or the keypad’s top already past where the keys touch', () => {
    // A rem as tall as the screen: the bottom margin alone fills the keypad.
    const cramped: UnitSizes = { ...SIZES, height: 0.16 };
    expect(dragged(handle('Keypad top'), LAYOUT, -8, cramped).keypad.top).toBe(
      LAYOUT.keypad.top + 50,
    );
    expect(dragged(handle('Keypad top'), LAYOUT, 8, cramped).keypad.top).toBe(LAYOUT.keypad.top);
    expect(dragged(handle('Key height'), LAYOUT, 8, cramped).keypad.keyHeight).toBe(
      LAYOUT.keypad.keyHeight,
    );
  });
});
