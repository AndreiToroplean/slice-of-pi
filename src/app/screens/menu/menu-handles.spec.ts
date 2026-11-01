import { dragged, Handle, UnitSizes } from '../../ui/handles/handle';
import { coreHandle, lightKnobs, PART_HANDLES } from './menu-handles';
import { MENU_LOOK, MenuLook } from './menu-look';

/** A rem of 16 pixels, a menu 800 pixels tall and a column 400 wide. */
const SIZES: UnitSizes = { rem: 16, height: 8, column: 4 };

function handle(handles: readonly Handle<MenuLook>[], label: string): Handle<MenuLook> {
  const found = handles.find((each) => each.label === label);
  if (found === undefined) {
    throw new Error(`No handle ${label}`);
  }
  return found;
}

describe('menu handles', () => {
  it('raises a part when dragged up, by its offset from the center of the icon and the name, across the column', () => {
    const look = dragged(handle(PART_HANDLES.pi, '“Pi” height'), MENU_LOOK, -16, SIZES);

    expect(look.layout.pi.offset).toBe(MENU_LOOK.layout.pi.offset + 4);
    expect(look.layout.title).toEqual(MENU_LOOK.layout.title);
  });

  it('grows a part by its right edge, which moves half as far as it widens, as it stays centered', () => {
    // 8 pixels right: the icon, 2 hundredths of the column wider on each side, 4 in all.
    expect(
      dragged(handle(PART_HANDLES.icon, 'Icon size'), MENU_LOOK, 8, SIZES).layout.icon.size,
    ).toBe(MENU_LOOK.layout.icon.size + 4);
    // "Pi" is 2.69 of its size wide: its edge moves 1.345 hundredths of the column for each unit.
    expect(
      dragged(handle(PART_HANDLES.pi, '“Pi” size'), MENU_LOOK, 1.345 * 4, SIZES).layout.pi.size,
    ).toBe(MENU_LOOK.layout.pi.size + 1);
  });

  it('sets where the buttons stand, their height and the gap between them, in rem', () => {
    const { buttons } = PART_HANDLES;
    const look = [
      dragged(handle(buttons, 'Buttons bottom'), MENU_LOOK, -16, SIZES),
      dragged(handle(buttons, 'Button height'), MENU_LOOK, -8, SIZES),
      dragged(handle(buttons, 'Button gap'), MENU_LOOK, 400, SIZES),
    ].map((each) => each.layout.buttons);

    expect(look).toEqual([
      { ...MENU_LOOK.layout.buttons, bottom: MENU_LOOK.layout.buttons.bottom + 1 },
      { ...MENU_LOOK.layout.buttons, height: MENU_LOOK.layout.buttons.height + 0.5 },
      { ...MENU_LOOK.layout.buttons, gap: 0 },
    ]);
  });

  it('widens the core of a light by as much as its ring is dragged out, round where its lights are', () => {
    const core = coreHandle('slice', { x: 195, y: 400 }, MENU_LOOK);

    expect(dragged(core, MENU_LOOK, 8, SIZES).light.slice.core).toBe(
      MENU_LOOK.light.slice.core + 1,
    );
    expect(core.ring).toBe(true);
    expect(core.line).toMatchObject({ left: '195px', top: '400px' });
  });

  it('moves a light’s other values with knobs dragged across, each within its range', () => {
    const knobs = lightKnobs('pi');

    expect(knobs.map((each) => each.label)).toEqual([
      'Intensity',
      'Falloff',
      'Reach',
      'Rays',
      'Ray count',
      'Saturation',
    ]);
    expect(dragged(handle(knobs, 'Intensity'), MENU_LOOK, 10, SIZES).light.pi.intensity).toBe(0.9);
    expect(dragged(handle(knobs, 'Ray count'), MENU_LOOK, 16, SIZES).light.pi.rayCount).toBe(16);
    expect(dragged(handle(knobs, 'Rays'), MENU_LOOK, 1000, SIZES).light.pi.rays).toBe(1);
  });
});
