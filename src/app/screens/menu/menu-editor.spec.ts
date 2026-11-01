import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { installDialogs, uninstallDialogs } from '../../../testing/fake-dialogs';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { MenuEditor } from './menu-editor';
import { MENU_LOOK, MenuLook, withLayout, withLight } from './menu-look';

@Component({
  imports: [MenuEditor],
  template: `<app-menu-editor [(look)]="look" (done)="done = done + 1" />`,
})
class Host {
  readonly look = signal<MenuLook>(MENU_LOOK);
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

  /** The slider of a group, by the group's title and its own label. */
  function slider(host: HTMLElement, group: string, label: string): HTMLInputElement | undefined {
    const details = Array.from(host.querySelectorAll('details')).find(
      (each) => each.querySelector('summary')?.textContent.trim() === group,
    );
    return (
      Array.from(details?.querySelectorAll('label') ?? [])
        .find((each) => each.querySelector('span')?.textContent.trim() === label)
        ?.querySelector('input') ?? undefined
    );
  }

  /** Drags a slider to a value, then lets it go. */
  function slide(input: HTMLInputElement | undefined, value: number): void {
    if (input === undefined) {
      throw new Error('No such slider');
    }
    input.value = String(value);
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
  }

  it('shows each value of the layout and of each layer’s light on a slider', async () => {
    const { host } = await setUp();

    expect(Array.from(host.querySelectorAll('summary'), (each) => each.textContent.trim())).toEqual(
      ['Icon', '“Slice of”', '“Pi”', 'Buttons', 'Icon Light', '“Slice of” Light', '“Pi” Light'],
    );
    expect(slider(host, '“Pi” Light', 'Falloff')?.valueAsNumber).toBe(MENU_LOOK.light.pi.falloff);
    expect(slider(host, 'Buttons', 'Gap')?.valueAsNumber).toBe(MENU_LOOK.layout.buttons.gap);
  });

  it('changes the look as a slider moves, saving it as a tweak once let go', async () => {
    const { host, editor, stable } = await setUp();

    slide(slider(host, 'Icon', 'Height'), 75);
    slide(slider(host, '“Slice of” Light', 'Rays'), 0.25);
    await stable();

    const look = withLight(withLayout(MENU_LOOK, 'icon', 'y', 75), 'slice', 'rays', 0.25);
    expect(editor.look()).toEqual(look);
    expect(TestBed.inject(Tweaks).menu()).toEqual(look);
  });

  it('asks on Cancel or Escape whether to cancel the changes, bringing back the look it started with', async () => {
    const { host, editor, stable } = await setUp();
    const dialog = host.querySelector('dialog');
    slide(slider(host, 'Icon', 'Size'), 50);

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
    expect(TestBed.inject(Tweaks).menu()).toEqual(MENU_LOOK);
  });

  it('brings back the menu’s own look on Reset, offered once the look is tuned', async () => {
    const { host, editor, stable } = await setUp();
    expect(button(host, 'Reset')?.disabled).toBe(true);
    slide(slider(host, '“Pi”', 'Size'), 15);
    await stable();

    button(host, 'Reset')?.click();
    await stable();

    expect(editor.look()).toEqual(MENU_LOOK);
    expect(TestBed.inject(Tweaks).menu()).toEqual(MENU_LOOK);
    expect(button(host, 'Reset')?.disabled).toBe(true);
  });

  it('hides the sliders while previewing, and shows them again', async () => {
    const { host, stable } = await setUp();
    const preview = host.querySelector<HTMLButtonElement>('button[title="Preview"]');

    preview?.click();
    await stable();
    expect(host.querySelector('input[type="range"]')).toBeNull();

    preview?.click();
    await stable();
    expect(host.querySelector('input[type="range"]')).not.toBeNull();
  });

  it('is done on Done, keeping the changes', async () => {
    const { host, editor, stable } = await setUp();
    slide(slider(host, 'Buttons', 'Height'), 4);

    button(host, 'Done')?.click();
    await stable();

    expect(editor.done).toBe(1);
    expect(TestBed.inject(Tweaks).menu().layout.buttons.height).toBe(4);
  });
});
