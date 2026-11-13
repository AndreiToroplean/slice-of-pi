import { ApplicationRef, Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { dialogNamed, installDialogs, uninstallDialogs } from '../../testing/fake-dialogs';
import { ChoiceDialog } from './choice-dialog';

@Component({
  imports: [ChoiceDialog],
  template: `
    <app-choice-dialog
      heading="Pick One"
      [dismissable]="dismissable()"
      (closed)="closings = closings + 1"
    >
      @if (corner()) {
        <button cornerStart type="button" class="corner" title="Corner"></button>
      }
      <p>What picking costs.</p>
      <button type="button">First</button>
      <button type="button">Second</button>
    </app-choice-dialog>
  `,
})
class Host {
  readonly dismissable = signal(true);
  readonly corner = signal(false);
  readonly dialog = viewChild.required(ChoiceDialog);
  closings = 0;
}

describe('ChoiceDialog', () => {
  beforeEach(() => {
    installDialogs();
  });

  afterEach(() => {
    uninstallDialogs();
  });

  async function setUp(): Promise<{ host: HTMLElement; page: Host; dialog: HTMLDialogElement }> {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    return { host, page: fixture.componentInstance, dialog: dialogNamed(host, 'Pick One') };
  }

  it('is named after its title, described by what it says, its buttons listed under it', async () => {
    const { host, dialog } = await setUp();

    const description = dialog.getAttribute('aria-describedby') ?? '';
    expect(host.querySelector(`#${description}`)?.textContent.trim()).toBe('What picking costs.');
    expect(
      Array.from(dialog.querySelectorAll('app-button-list button'), (button) =>
        button.textContent.trim(),
      ),
    ).toEqual(['First', 'Second']);
  });

  it('opens, its first choice taking the focus, and closes, telling it closed', async () => {
    const { page, dialog } = await setUp();

    page.dialog().open();
    expect(dialog.open).toBe(true);
    expect(page.dialog().isOpen).toBe(true);
    // For the browser to give the focus to the first choice as it opens.
    expect(dialog.querySelector('[autofocus]')?.textContent.trim()).toBe('First');

    await page.dialog().close();
    expect(dialog.open).toBe(false);
    expect(page.closings).toBe(1);
  });

  it('keeps a hidden button on either side of the title, under the corner buttons it has', async () => {
    const { host, page } = await setUp();
    expect(host.querySelectorAll('.corner-place .unused')).toHaveLength(2);

    page.corner.set(true);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(host.querySelector('.corner-place.start button[title="Corner"]')).not.toBeNull();
    expect(host.querySelectorAll('.corner-place .unused')).toHaveLength(2);
  });

  it('closes only on a press or a key coming after it opened, not the release of one under way', async () => {
    const { page, dialog } = await setUp();

    page.dialog().open();
    expect(dialog.getAttribute('closedby')).toBe('none');
    document.dispatchEvent(new PointerEvent('pointerdown'));
    expect(dialog.getAttribute('closedby')).toBe('any');

    await page.dialog().close();
    page.dismissable.set(false);
    await TestBed.inject(ApplicationRef).whenStable();
    page.dialog().open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialog.getAttribute('closedby')).toBe('none');
  });

  it('closes on Escape or a click outside it, unless it cannot be dismissed', async () => {
    const { page, dialog } = await setUp();
    const cancel = (): Event => {
      const event = new Event('cancel', { cancelable: true });
      dialog.dispatchEvent(event);
      return event;
    };
    expect(dialog.getAttribute('closedby')).toBe('any');
    expect(cancel().defaultPrevented).toBe(false);

    page.dismissable.set(false);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(dialog.getAttribute('closedby')).toBe('none');
    expect(cancel().defaultPrevented).toBe(true);
  });
});
