import {
  BUTTON_SLOTS,
  MENU_LOOK,
  menuStyles,
  parseMenuLook,
  titleReach,
  withIconLight,
  withLayout,
  withLight,
} from './menu-look';

/** The value of arithmetic in numbers, `+`, `-`, `*`, `/` and parentheses, as CSS's `calc` reads it. */
function evaluate(arithmetic: string): number {
  const tokens = arithmetic.match(/\d+(?:\.\d+)?|[()+\-*/]/g) ?? [];
  let at = 0;
  const next = (): string | undefined => tokens[at++];
  const factor = (): number => {
    const token = next();
    if (token === '(') {
      const value = sum();
      next();
      return value;
    }
    return token === '-' ? -factor() : Number(token);
  };
  const product = (): number => {
    let value = factor();
    while (tokens[at] === '*' || tokens[at] === '/') {
      value = next() === '*' ? value * factor() : value / factor();
    }
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (tokens[at] === '+' || tokens[at] === '-') {
      value = next() === '+' ? value + product() : value - product();
    }
    return value;
  };
  return sum();
}

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

  /**
   * A length the menu lays out with, in pixels, in a menu `height` pixels tall, with a column 400 wide and a rem of 16:
   * its CSS, but for `calc`, is arithmetic in those.
   */
  function pixels(css: string | undefined, height: number): number {
    const arithmetic = (css ?? 'NaN')
      .replaceAll('calc', '')
      .replaceAll('100%', String(height))
      .replaceAll('var(--column)', '400')
      .replace(/(\d+(?:\.\d+)?)rem/g, '($1 * 16)');
    return evaluate(arithmetic);
  }

  it('keeps the icon and the name together whatever the menu’s height', () => {
    const styles = menuStyles(MENU_LOOK);
    const apart = (height: number): number[] =>
      ['--icon-y', '--slice-y'].map(
        (part) => pixels(styles[part], height) - pixels(styles['--pi-y'], height),
      );

    expect(apart(700)).toEqual(apart(900).map((each) => expect.closeTo(each, 9) as number));
  });

  it('shares the free space between above the title, below the buttons and between them, each shrinking by its share', () => {
    const styles = menuStyles(MENU_LOOK);
    const { up, down } = titleReach(MENU_LOOK.layout);
    const { above } = MENU_LOOK.layout.title;
    const { below } = MENU_LOOK.layout.buttons;
    for (const height of [915, 760, 680]) {
      const span = pixels(styles['--buttons-span'], height);
      const center = pixels(
        `calc(${styles['--pi-y'] ?? ''} - ${String(MENU_LOOK.layout.pi.offset)} * var(--column) / 100)`,
        height,
      );
      const buttons = pixels(styles['--buttons-y'], height);
      const free = pixels(styles['--menu-free'], height);
      const spaces = {
        above: height - (center + (up * 400) / 100),
        below: buttons - span / 2,
        between: center - (down * 400) / 100 - (buttons + span / 2),
      };

      expect(free).toBeCloseTo(height - ((up + down) * 400) / 100 - span, 9);
      expect(spaces.above).toBeCloseTo((above * free) / 100, 9);
      expect(spaces.below).toBeCloseTo((below * free) / 100, 9);
      expect(spaces.between).toBeCloseTo(((100 - above - below) * free) / 100, 9);
    }
  });

  it('reaches from the top of the title’s highest part to the bottom of its lowest', () => {
    const layout = withLayout(
      withLayout(MENU_LOOK, 'icon', 'offset', 30),
      'pi',
      'offset',
      -40,
    ).layout;

    // The square icon, 30 up, half its size above; "Pi", 40 down, half its lanterns' height below.
    expect(titleReach(layout)).toEqual({
      up: 30 + layout.icon.size / 2,
      down: 40 + (1.625 * layout.pi.size) / 2,
    });
  });

  it('stacks the buttons round their middle', () => {
    const styles = menuStyles(MENU_LOOK);
    const { height, gap } = MENU_LOOK.layout.buttons;

    expect(styles['--buttons-span']).toBe(
      `${String(BUTTON_SLOTS * height + (BUTTON_SLOTS - 1) * gap)}rem`,
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
