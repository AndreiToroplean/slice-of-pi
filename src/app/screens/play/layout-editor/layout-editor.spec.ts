import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { installDialogs, uninstallDialogs } from '../../../../testing/fake-dialogs';
import { DeveloperMode } from '../../../developer-mode/developer-mode';
import { Tweaks } from '../../../developer-mode/tweaks';
import { Layout, LAYOUT } from '../../../ui/layout';
import { LayoutEditor } from './layout-editor';

@Component({
  imports: [LayoutEditor],
  template: `<app-layout-editor [(layout)]="layout" (done)="done = done + 1" />`,
})
class Host {
  readonly layout = signal<Layout>(LAYOUT);
  done = 0;
}

describe('LayoutEditor', () => {
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

  /** Picks a part of the screen out, by its name. */
  async function pick(host: HTMLElement, part: string, stable: () => Promise<void>): Promise<void> {
    host.querySelector<HTMLButtonElement>(`button.part[aria-label="${part}"]`)?.click();
    await stable();
  }

  function press(knob: Element | null, key: string): void {
    knob?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  }

  it('shows the handles of the page until a part is picked out, then those of the part alone', async () => {
    const { host, stable } = await setUp();
    const sliders = (): (string | null)[] =>
      Array.from(host.querySelectorAll('[role="slider"]'), (slider) =>
        slider.getAttribute('aria-label'),
      );
    expect(sliders()).toEqual([
      'Top margin',
      'Corner size',
      'Corner radius',
      'Side margins',
      'Bottom margin',
    ]);

    await pick(host, 'Keypad', stable);
    expect(sliders()).toEqual([
      'Touch top',
      'Keypad top',
      'Key width',
      'Key height',
      'Key radius',
      'Key depth',
    ]);
    expect(host.querySelector('[aria-label="Keypad top"]')?.getAttribute('aria-valuenow')).toBe(
      String(LAYOUT.keypad.top),
    );

    await pick(host, 'Tape', stable);
    expect(sliders()).toEqual(['Tape top', 'Tiles', 'Tape bottom']);

    // Picked again, none is.
    await pick(host, 'Tape', stable);
    expect(sliders()).toContain('Top margin');
  });

  it('steps a value with the arrow keys and Page Up and Down, saving each step as a tweak', async () => {
    const { host, editor, stable } = await setUp();
    await pick(host, 'Slots', stable);
    const knob = host.querySelector('[aria-label="Slots top"]');

    press(knob, 'ArrowUp');
    press(knob, 'PageDown');
    await stable();

    const layout = {
      ...LAYOUT,
      slots: { ...LAYOUT.slots, top: Number((LAYOUT.slots.top - 0.9).toFixed(4)) },
    };
    expect(editor.layout()).toEqual(layout);
    expect(knob?.getAttribute('aria-valuenow')).toBe(String(layout.slots.top));
    expect(TestBed.inject(Tweaks).layout()).toEqual(layout);
  });

  it('leaves other keys alone', async () => {
    const { host, editor, stable } = await setUp();
    await pick(host, 'Header', stable);
    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });

    host.querySelector('[role="slider"][aria-label="Header"]')?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(editor.layout()).toBe(LAYOUT);
  });

  it('is done on Done, keeping the changes', async () => {
    const { host, editor, stable } = await setUp();
    await pick(host, 'Header', stable);
    press(host.querySelector('[role="slider"][aria-label="Header"]'), 'ArrowUp');

    button(host, 'Done')?.click();
    await stable();

    expect(editor.done).toBe(1);
    expect(TestBed.inject(Tweaks).layout().header.size).toBe(LAYOUT.header.size + 0.1);
  });

  it('asks on Cancel or Escape whether to cancel the changes, bringing back the layout it started with', async () => {
    const { host, editor, stable } = await setUp();
    await pick(host, 'Header', stable);
    const dialog = host.querySelector('dialog');
    press(host.querySelector('[role="slider"][aria-label="Header"]'), 'ArrowUp');

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(dialog?.open).toBe(true);
    button(host, 'Continue Editing')?.click();
    expect(dialog?.open).toBe(false);
    expect(editor.done).toBe(0);

    button(host, 'Cancel')?.click();
    expect(dialog?.open).toBe(true);
    button(host, 'Yes')?.click();
    await stable();

    expect(dialog?.open).toBe(false);
    expect(editor.done).toBe(1);
    expect(editor.layout()).toEqual(LAYOUT);
    expect(TestBed.inject(Tweaks).layout()).toEqual(LAYOUT);
  });

  it('brings back the game’s own layout on Reset, offered once the layout is tuned', async () => {
    const { host, editor, stable } = await setUp();
    await pick(host, 'Header', stable);
    expect(button(host, 'Reset')?.disabled).toBe(true);
    press(host.querySelector('[role="slider"][aria-label="Header"]'), 'ArrowUp');
    await stable();
    expect(button(host, 'Reset')?.disabled).toBe(false);

    button(host, 'Reset')?.click();
    await stable();

    expect(editor.layout()).toEqual(LAYOUT);
    expect(TestBed.inject(Tweaks).layout()).toEqual(LAYOUT);
    expect(button(host, 'Reset')?.disabled).toBe(true);
  });

  it('hides the handles while previewing, as a toggle, and shows them again', async () => {
    const { host, stable } = await setUp();
    const preview = host.querySelector<HTMLButtonElement>('button[title="Preview"]');
    expect(preview?.getAttribute('aria-pressed')).toBe('false');

    preview?.click();
    await stable();
    expect(preview?.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('[role="slider"]')).toBeNull();
    expect(button(host, 'Done')).toBeDefined();

    preview?.click();
    await stable();
    expect(preview?.getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelectorAll('[role="slider"]').length).toBe(5);
  });

  it('offers to copy the layout', async () => {
    const { host } = await setUp();

    expect(
      Array.from(host.querySelectorAll('button'), (button) => button.textContent.trim()),
    ).toContain('Copy');
  });
});
