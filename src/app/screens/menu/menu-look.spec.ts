import {
  BUTTON_COUNT,
  MENU_LOOK,
  menuStyles,
  parseMenuLook,
  withIconLight,
  withLayout,
  withLight,
} from './menu-look';

describe('menu look', () => {
  it('sets one value of the layout, or of a layer’s light, leaving the others', () => {
    const look = withLight(withLayout(MENU_LOOK, 'pi', 'offset', 40), 'slice', 'rays', 0.2);

    expect(look.layout).toEqual({
      ...MENU_LOOK.layout,
      pi: { ...MENU_LOOK.layout.pi, offset: 40 },
    });
    expect(look.light).toEqual({
      ...MENU_LOOK.light,
      slice: { ...MENU_LOOK.light.slice, rays: 0.2 },
    });
  });

  it('lays the parts out as CSS lengths: sizes across the column, buttons in rem', () => {
    const styles = menuStyles(MENU_LOOK);

    expect(styles['--icon-size']).toBe(
      `calc(${String(MENU_LOOK.layout.icon.size)} * var(--column) / 100)`,
    );
    expect(styles['--buttons-gap']).toBe(`${String(MENU_LOOK.layout.buttons.gap)}rem`);
  });

  it('keeps the icon and the name together whatever the menu’s height: only their center is a share of it', () => {
    const styles = menuStyles(withLayout(MENU_LOOK, 'pi', 'offset', -20));

    expect(styles['--pi-y']).toBe(
      `calc(${String(MENU_LOOK.layout.title.y)}% + -20 * var(--column) / 100)`,
    );
    expect(styles['--icon-y']).toBe(
      `calc(${String(MENU_LOOK.layout.title.y)}% + ${String(MENU_LOOK.layout.icon.offset)} * var(--column) / 100)`,
    );
  });

  it('stacks the buttons round their middle, a height of the menu', () => {
    const styles = menuStyles(MENU_LOOK);
    const { y, height, gap } = MENU_LOOK.layout.buttons;

    expect(styles['--buttons-y']).toBe(`${String(y)}%`);
    expect(styles['--buttons-span']).toBe(
      `${String(BUTTON_COUNT * height + (BUTTON_COUNT - 1) * gap)}rem`,
    );
  });

  it('reads a stored look back as it was', () => {
    const look = withIconLight(
      withLight(withLayout(MENU_LOOK, 'buttons', 'gap', 2), 'icon', 'rayCount', 30),
      { color: '#123abc', offset: -3 },
    );

    expect(parseMenuLook(JSON.parse(JSON.stringify(look)))).toEqual(look);
  });

  it('takes the menu’s own value for each one missing, out of range or not a number', () => {
    const stored = {
      layout: { icon: { size: 500 }, pi: { y: '40' }, slice: { size: 9 } },
      light: { pi: { falloff: -1, intensity: 1.2 } },
    };

    expect(parseMenuLook(stored)).toEqual(
      withLight(withLayout(MENU_LOOK, 'slice', 'size', 9), 'pi', 'intensity', 1.2),
    );
    expect(parseMenuLook({ iconLight: { offset: 5, color: 'orange' } })?.iconLight).toEqual({
      offset: 5,
      color: MENU_LOOK.iconLight.color,
    });
    expect(parseMenuLook('menu')).toBeUndefined();
    expect(parseMenuLook(null)).toBeUndefined();
  });
});
