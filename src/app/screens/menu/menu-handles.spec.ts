import { dragged, Handle, UnitSizes } from '../../ui/handles/handle';
import { coreHandle, lightKnobs, PART_HANDLES } from './menu-handles';
import { BUTTON_COUNT, MENU_LOOK, MenuLook } from './menu-look';

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
  it('raises a part with those above it, as they stand on one another: "Pi" the whole group', () => {
    const icon = dragged(handle(PART_HANDLES.icon, 'Icon height'), MENU_LOOK, -16, SIZES).layout;
    const slice = dragged(
      handle(PART_HANDLES.slice, '“Slice of” height'),
      MENU_LOOK,
      -16,
      SIZES,
    ).layout;
    const pi = dragged(handle(PART_HANDLES.pi, '“Pi” height'), MENU_LOOK, -16, SIZES).layout;

    // The offsets in hundredths of the column's width, 4 pixels each.
    const raised = (part: 'icon' | 'slice'): Record<string, number> => ({
      ...MENU_LOOK.layout[part],
      offset: Number((MENU_LOOK.layout[part].offset + 4).toFixed(4)),
    });
    expect(icon).toEqual({ ...MENU_LOOK.layout, icon: raised('icon') });
    expect(slice).toEqual({ ...MENU_LOOK.layout, icon: raised('icon'), slice: raised('slice') });
    // The group's center, in hundredths of the menu's height, 8 pixels each.
    expect(pi).toEqual({ ...MENU_LOOK.layout, title: { y: MENU_LOOK.layout.title.y + 2 } });
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

  it('sets the buttons’ middle as a height of the menu, and their size and gap in rem, round it', () => {
    const { buttons } = PART_HANDLES;
    const look = [
      dragged(handle(buttons, 'Buttons height'), MENU_LOOK, -16, SIZES),
      // The group's top, which moves half as much as all the buttons grow, half on each side.
      dragged(handle(buttons, 'Button size'), MENU_LOOK, (-8 * BUTTON_COUNT) / 2, SIZES),
      // The bottom of the first, which moves half as much as the gaps grow.
      dragged(handle(buttons, 'Button gap'), MENU_LOOK, (-8 * (BUTTON_COUNT - 1)) / 2, SIZES),
    ].map((each) => each.layout.buttons);

    expect(look).toEqual([
      { ...MENU_LOOK.layout.buttons, y: MENU_LOOK.layout.buttons.y + 2 },
      { ...MENU_LOOK.layout.buttons, height: MENU_LOOK.layout.buttons.height + 0.5 },
      { ...MENU_LOOK.layout.buttons, gap: MENU_LOOK.layout.buttons.gap + 0.5 },
    ]);
  });

  it('moves the icon’s light up and down, by its offset from the icon’s middle', () => {
    const look = dragged(handle(PART_HANDLES.icon, 'Icon light height'), MENU_LOOK, -8, SIZES);

    expect(look.iconLight).toEqual({
      ...MENU_LOOK.iconLight,
      offset: MENU_LOOK.iconLight.offset + 2,
    });
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
    expect(dragged(handle(knobs, 'Intensity'), MENU_LOOK, 10, SIZES).light.pi.intensity).toBe(
      MENU_LOOK.light.pi.intensity + 0.1,
    );
    expect(dragged(handle(knobs, 'Ray count'), MENU_LOOK, 16, SIZES).light.pi.rayCount).toBe(
      MENU_LOOK.light.pi.rayCount + 2,
    );
    expect(dragged(handle(knobs, 'Rays'), MENU_LOOK, 1000, SIZES).light.pi.rays).toBe(1);
  });
});
