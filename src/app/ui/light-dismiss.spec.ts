import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { installDialogs, uninstallDialogs } from '../../testing/fake-dialogs';
import { LightDismiss } from './light-dismiss';

@Component({
  imports: [LightDismiss],
  template: `<dialog closedby="any"><button type="button">Inside</button></dialog>`,
})
class Host {}

describe('LightDismiss', () => {
  beforeEach(() => {
    installDialogs();
  });

  afterEach(() => {
    uninstallDialogs();
  });

  async function setUp(): Promise<HTMLDialogElement> {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog');
    if (dialog === null) {
      throw new Error('No dialog');
    }
    dialog.getBoundingClientRect = (): DOMRect => new DOMRect(100, 100, 200, 300);
    dialog.showModal();
    return dialog;
  }

  const click = (target: Element, x: number, y: number): void => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
  };

  it('closes on a click outside the dialog, on its backdrop', async () => {
    const dialog = await setUp();

    click(dialog, 50, 200);

    expect(dialog.open).toBe(false);
  });

  it('stays open on a click inside the dialog, on its padding or what it holds', async () => {
    const dialog = await setUp();

    click(dialog, 150, 200);
    const button = dialog.querySelector('button');
    if (button === null) {
      throw new Error('No button');
    }
    click(button, 50, 200);

    expect(dialog.open).toBe(true);
  });
});
