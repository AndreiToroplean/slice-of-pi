import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { installDialogs, uninstallDialogs } from '../../../testing/fake-dialogs';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { Layout, LAYOUT } from '../../ui/layout';
import { Light } from '../../ui/light-layer';
import { MenuEditor } from './menu-editor';
import { hexToHsl, hslToHex } from '../../game/color/color-spaces';
import { LightLayer, MENU_LOOK, MenuLook, withLayout, withLight } from './menu-look';

@Component({
  imports: [MenuEditor],
  template: `<app-menu-editor
    [(look)]="look"
    [(layout)]="layout"
    [lights]="lights"
    (done)="done = done + 1"
  />`,
})
class Host {
  readonly look = signal<MenuLook>(MENU_LOOK);
  /** The play screen's layout tuned, which the menu's editor leaves alone. */
  readonly layout = signal<Layout>({ ...LAYOUT, keypad: { ...LAYOUT.keypad, top: 40 } });
  readonly lights: Readonly<Record<LightLayer, readonly Light[]>> = {
    icon: [{ x: 195, y: 300, color: '#ffc780', seed: 1 }],
    slice: [
      { x: 100, y: 400, color: '#e3402f', seed: 2 },
      { x: 200, y: 400, color: '#fd7225', seed: 3 },
    ],
    pi: [],
  };
  done = 0;
}

describe('MenuEditor', () => {
  beforeEach(() => {
    installDialogs();
  });

  afterEach(() => {
    uninstallDialogs();
  });

  async function setUp(): Promise<{
    host: HTMLElement;
    editor: Host;
    stable: () => Promise<void>;
  }> {
    await TestBed.inject(DeveloperMode).set(true);
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return {
      host: fixture.nativeElement as HTMLElement,
      editor: fixture.componentInstance,
      stable: () => fixture.whenStable(),
    };
  }

  function button(host: HTMLElement, label: string): HTMLButtonElement | undefined {
    return Array.from(host.querySelectorAll('button')).find(
      (each) => each.textContent.trim() === label,
    );
  }

  const sliders = (host: HTMLElement): (string | null)[] =>
    Array.from(host.querySelectorAll('[role="slider"]'), (slider) =>
      slider.getAttribute('aria-label'),
    );

  function press(host: HTMLElement, label: string, key: string): void {
    host
      .querySelector(`[role="slider"][aria-label="${label}"]`)
      ?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  }

  async function pick(host: HTMLElement, part: string, stable: () => Promise<void>): Promise<void> {
    host.querySelector<HTMLButtonElement>(`button.part[aria-label="${part}"]`)?.click();
    await stable();
  }

  it('shows the handles of the margins and corner buttons until a part is picked out', async () => {
    const { host } = await setUp();

    expect(sliders(host)).toEqual([
      'Top margin',
      'Corner size',
      'Corner radius',
      'Side margins',
      'Bottom margin',
    ]);
  });

  it('shows the handles of the part picked out, with those of its light, until tapped again', async () => {
    const { host, stable } = await setUp();

    await pick(host, '“Slice of”', stable);
    expect(sliders(host)).toEqual([
      'Intensity',
      'Falloff',
      'Reach',
      'Rays',
      'Ray count',
      'Saturation',
      '“Slice of” height',
      '“Slice of” size',
      'Light core',
    ]);
    expect(button(host, 'Light color')).toBeUndefined();
    expect(host.querySelector('.picked')?.textContent).toBe('“Slice of”');
    // Its core, round the middle of its lights.
    const core = host.querySelector<HTMLElement>('[aria-label="Light core"]')?.parentElement;
    expect([core?.style.left, core?.style.top]).toEqual(['150px', '400px']);

    await pick(host, 'Buttons', stable);
    expect(sliders(host)).toEqual(['Buttons height', 'Button width', 'Button size', 'Button gap']);

    await pick(host, 'Buttons', stable);
    expect(sliders(host)).toContain('Top margin');
  });

  it('saves each change as a tweak: the look, and the margins in the layout of every screen', async () => {
    const { host, editor, stable } = await setUp();
    press(host, 'Top margin', 'ArrowUp');
    await pick(host, 'Icon', stable);
    press(host, 'Icon height', 'PageUp');
    press(host, 'Rays', 'ArrowDown');
    await stable();

    const look = withLight(
      withLayout(MENU_LOOK, 'icon', 'offset', MENU_LOOK.layout.icon.offset + 1),
      'icon',
      'rays',
      MENU_LOOK.light.icon.rays - 0.01,
    );
    expect(editor.look()).toEqual(look);
    expect(TestBed.inject(Tweaks).menu()).toEqual(look);
    expect(TestBed.inject(Tweaks).layout().margins.top).toBe(LAYOUT.margins.top + 0.0625);
  });

  it('moves the icon’s light, and colors it with the color picker, closed again once the icon is not picked out', async () => {
    const { host, editor, stable } = await setUp();
    await pick(host, 'Icon', stable);
    press(host, 'Icon light height', 'ArrowUp');
    const swatch = button(host, 'Light color');
    expect(host.querySelector('app-color-picker')).toBeNull();

    swatch?.click();
    await stable();
    const hue = host.querySelector<HTMLInputElement>(
      'app-color-picker input[aria-label="Icon light hue"]',
    );
    if (hue === null) {
      throw new Error('No color picker');
    }
    hue.value = '200';
    hue.dispatchEvent(new Event('input'));
    await stable();

    const color = hslToHex({ ...hexToHsl(MENU_LOOK.iconLight.color), hue: 200 });
    const iconLight = { offset: MENU_LOOK.iconLight.offset + 0.1, color };
    expect(editor.look().iconLight).toEqual(iconLight);
    expect(TestBed.inject(Tweaks).menu().iconLight).toEqual(iconLight);

    await pick(host, 'Icon', stable);
    expect(host.querySelector('app-color-picker')).toBeNull();
  });

  it('asks on Cancel or Escape whether to cancel the changes, bringing back what it started with', async () => {
    const { host, editor, stable } = await setUp();
    const started = editor.layout();
    const dialog = host.querySelector('dialog');
    press(host, 'Side margins', 'ArrowUp');
    await pick(host, '“Pi”', stable);
    press(host, '“Pi” size', 'ArrowUp');

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(escape);
    expect(dialog?.open).toBe(true);
    button(host, 'Continue Editing')?.click();
    expect(editor.done).toBe(0);

    button(host, 'Cancel')?.click();
    button(host, 'Yes')?.click();
    await stable();

    expect(editor.done).toBe(1);
    expect(editor.look()).toEqual(MENU_LOOK);
    expect(editor.layout()).toEqual(started);
  });

  it('brings back the menu’s own look and the game’s own margins on Reset, leaving the play screen’s layout', async () => {
    const { host, editor, stable } = await setUp();
    expect(button(host, 'Reset')?.disabled).toBe(true);
    press(host, 'Bottom margin', 'ArrowDown');
    await stable();
    expect(button(host, 'Reset')?.disabled).toBe(false);

    button(host, 'Reset')?.click();
    await stable();

    expect(editor.look()).toEqual(MENU_LOOK);
    expect(editor.layout().margins).toEqual(LAYOUT.margins);
    expect(editor.layout().keypad.top).toBe(40);
    expect(button(host, 'Reset')?.disabled).toBe(true);
  });

  it('hides its handles while previewing, and shows them again', async () => {
    const { host, stable } = await setUp();
    const preview = host.querySelector<HTMLButtonElement>('button[title="Preview"]');

    preview?.click();
    await stable();
    expect(sliders(host)).toEqual([]);
    expect(host.querySelector('app-parts')?.classList).toContain('unseen');

    preview?.click();
    await stable();
    expect(sliders(host)).toContain('Top margin');
  });

  it('stops previewing on a tap on a part, picking it out', async () => {
    const { host, stable } = await setUp();
    host.querySelector<HTMLButtonElement>('button[title="Preview"]')?.click();
    await stable();
    expect(host.querySelector('[role="slider"]')).toBeNull();

    await pick(host, 'Icon', stable);

    expect(host.querySelector('button[title="Preview"]')?.getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(
      host.querySelector(`[role="slider"][aria-label=${JSON.stringify('Icon height')}]`),
    ).not.toBeNull();
  });

  it('is done on Done, keeping the changes', async () => {
    const { host, editor, stable } = await setUp();
    await pick(host, 'Buttons', stable);
    press(host, 'Button gap', 'ArrowUp');

    button(host, 'Done')?.click();
    await stable();

    expect(editor.done).toBe(1);
    expect(TestBed.inject(Tweaks).menu().layout.buttons.gap).toBe(
      MENU_LOOK.layout.buttons.gap + 0.0625,
    );
  });
});
