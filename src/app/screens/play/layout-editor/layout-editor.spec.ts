import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { installDialogs, uninstallDialogs } from '../../../../testing/fake-dialogs';
import { DeveloperMode } from '../../../developer-mode/developer-mode';
import { Tweaks } from '../../../developer-mode/tweaks';
import { Layout, LAYOUT } from '../../../ui/layout';
import { LayoutEditor } from './layout-editor';
import { LAYOUT_HANDLES } from './layout-handles';

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

  function press(knob: Element | null, key: string): void {
    knob?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  }

  it('shows a labelled slider for each handle, at its value', async () => {
    const { host } = await setUp();
    const sliders = Array.from(host.querySelectorAll('[role="slider"]'));

    expect(sliders.map((slider) => slider.getAttribute('aria-label'))).toEqual(
      LAYOUT_HANDLES.map((handle) => handle.label),
    );
    expect(host.querySelector('[aria-label="Keypad top"]')?.getAttribute('aria-valuenow')).toBe(
      String(LAYOUT.keypad.top),
    );
  });

  it('steps a value with the arrow keys and Page Up and Down, saving each step as a tweak', async () => {
    const { host, editor, stable } = await setUp();
    const knob = host.querySelector('[aria-label="Slots top"]');

    press(knob, 'ArrowUp');
    press(knob, 'PageDown');
    await stable();

    const layout = { ...LAYOUT, slots: { ...LAYOUT.slots, top: LAYOUT.slots.top - 0.9 } };
    expect(editor.layout()).toEqual(layout);
    expect(knob?.getAttribute('aria-valuenow')).toBe(String(layout.slots.top));
    expect(TestBed.inject(Tweaks).layout()).toEqual(layout);
  });

  it('leaves other keys alone', async () => {
    const { host, editor } = await setUp();
    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });

    host.querySelector('[aria-label="Header"]')?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(editor.layout()).toBe(LAYOUT);
  });

  it('is done on Done, keeping the changes', async () => {
    const { host, editor, stable } = await setUp();
    press(host.querySelector('[aria-label="Header"]'), 'ArrowUp');

    button(host, 'Done')?.click();
    await stable();

    expect(editor.done).toBe(1);
    expect(TestBed.inject(Tweaks).layout().header.size).toBe(LAYOUT.header.size + 0.1);
  });

  it('asks on Cancel or Escape whether to cancel the changes, bringing back the layout it started with', async () => {
    const { host, editor, stable } = await setUp();
    const dialog = host.querySelector('dialog');
    press(host.querySelector('[aria-label="Header"]'), 'ArrowUp');

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
    expect(button(host, 'Reset')?.disabled).toBe(true);
    press(host.querySelector('[aria-label="Header"]'), 'ArrowUp');
    await stable();
    expect(button(host, 'Reset')?.disabled).toBe(false);

    button(host, 'Reset')?.click();
    await stable();

    expect(editor.layout()).toEqual(LAYOUT);
    expect(TestBed.inject(Tweaks).layout()).toEqual(LAYOUT);
    expect(button(host, 'Reset')?.disabled).toBe(true);
  });

  it('offers to copy the layout', async () => {
    const { host } = await setUp();

    expect(
      Array.from(host.querySelectorAll('button'), (button) => button.textContent.trim()),
    ).toContain('Copy Layout');
  });
});
