import { LAYOUT } from '../../../ui/layout';
import { dragged, LAYOUT_HANDLES, LayoutHandle, stepped, UnitSizes } from './layout-handles';

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
    expect(dragged(handle('Top margin'), LAYOUT, 16, SIZES).margins.top).toBe(1.625);
    expect(dragged(handle('Corners'), LAYOUT, -8, SIZES).corner.size).toBe(2.25);
    expect(dragged(handle('Slot width'), LAYOUT, 4, SIZES).slots.width).toBe(9.1);
  });

  it('raises what’s measured up from the bottom when dragged up', () => {
    expect(dragged(handle('Keypad top'), LAYOUT, -40, SIZES).keypad.top).toBe(40);
    expect(dragged(handle('Bottom margin'), LAYOUT, 16, SIZES).margins.bottom).toBe(0.125);
  });

  it('grows the tiles by twice as much as their top edge moves, as they stay across the tape’s middle', () => {
    expect(dragged(handle('Tiles'), LAYOUT, -8, SIZES).tape.words).toBe(LAYOUT.tape.words + 2);
  });

  it('rounds each value to the finest step of its unit', () => {
    expect(dragged(handle('Keypad top'), LAYOUT, -3, SIZES).keypad.top).toBe(35.4);
    expect(dragged(handle('Side margins'), LAYOUT, 3, SIZES).margins.side).toBe(1.3125);
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
      keypad: { top: LAYOUT.keypad.top + 2 },
    });
  });

  it('steps a value by the finest step of its unit, up or down', () => {
    expect(stepped(handle('Keypad top'), LAYOUT, 1, SIZES).keypad.top).toBe(35.1);
    expect(stepped(handle('Corners'), LAYOUT, -10, SIZES).corner.size).toBe(2.125);
  });

  it('changes only the value of the handle', () => {
    for (const each of LAYOUT_HANDLES) {
      const changed = stepped(each, LAYOUT, -1, SIZES);
      expect(each.set(changed, each.get(LAYOUT), SIZES)).toEqual(LAYOUT);
    }
  });
});
