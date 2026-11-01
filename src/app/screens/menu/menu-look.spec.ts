import { MENU_LOOK, menuStyles, parseMenuLook, withLayout, withLight } from './menu-look';

describe('menu look', () => {
  it('sets one value of the layout, or of a layer’s light, leaving the others', () => {
    const look = withLight(withLayout(MENU_LOOK, 'pi', 'y', 40), 'slice', 'rays', 0.2);

    expect(look.layout).toEqual({ ...MENU_LOOK.layout, pi: { ...MENU_LOOK.layout.pi, y: 40 } });
    expect(look.light).toEqual({
      ...MENU_LOOK.light,
      slice: { ...MENU_LOOK.light.slice, rays: 0.2 },
    });
  });

  it('lays the parts out as CSS lengths: sizes across the column, heights up the menu, buttons in rem', () => {
    const styles = menuStyles(MENU_LOOK.layout);

    expect(styles['--icon-size']).toBe(
      `calc(${String(MENU_LOOK.layout.icon.size)} * var(--column) / 100)`,
    );
    expect(styles['--pi-y']).toBe(`${String(MENU_LOOK.layout.pi.y)}%`);
    expect(styles['--buttons-gap']).toBe(`${String(MENU_LOOK.layout.buttons.gap)}rem`);
  });

  it('reads a stored look back as it was', () => {
    const look = withLight(withLayout(MENU_LOOK, 'buttons', 'gap', 2), 'icon', 'rayCount', 30);

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
    expect(parseMenuLook('menu')).toBeUndefined();
    expect(parseMenuLook(null)).toBeUndefined();
  });
});
