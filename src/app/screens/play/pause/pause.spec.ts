import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { installDialogs, uninstallDialogs } from '../../../../testing/fake-dialogs';
import { DeveloperMode } from '../../../developer-mode/developer-mode';
import { INDEXED_DB } from '../../../player-data/run-store';
import { Pause } from './pause';

describe('Pause', () => {
  beforeEach(() => {
    installDialogs();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: INDEXED_DB, useValue: undefined }],
    });
  });

  afterEach(() => {
    uninstallDialogs();
  });

  async function setUp(): Promise<{
    host: HTMLElement;
    pause: Pause;
    dialog: HTMLDialogElement;
    click: (label: string) => Promise<void>;
    replayable: () => Promise<void>;
  }> {
    const fixture = TestBed.createComponent(Pause);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const dialog = host.querySelector('dialog');
    if (dialog === null) {
      throw new Error('No dialog');
    }
    const click = async (label: string): Promise<void> => {
      Array.from(host.querySelectorAll('button'))
        .find((button) => button.textContent.trim() === label || button.ariaLabel === label)
        ?.click();
      await fixture.whenStable();
    };
    const replayable = async (): Promise<void> => {
      fixture.componentRef.setInput('replayable', true);
      await fixture.whenStable();
    };
    return { host, pause: fixture.componentInstance, dialog, click, replayable };
  }

  it('pauses with a labelled button, opening a dialog named after its heading', async () => {
    const { pause, dialog, click } = await setUp();
    expect(dialog.open).toBe(false);

    await click('Pause');

    expect(dialog.open).toBe(true);
    expect(pause.paused()).toBe(true);
    expect(dialog.getAttribute('aria-labelledby')).toBe('pause-title');
    expect(dialog.querySelector('#pause-title')?.textContent).toBe('Paused');
  });

  it('pauses on Escape, leaving it to the dialog to close on the next', async () => {
    const { pause, dialog } = await setUp();
    const escape = (): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      return event;
    };

    expect(escape().defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
    expect(pause.paused()).toBe(true);

    expect(escape().defaultPrevented).toBe(false);
    expect(dialog.open).toBe(true);
  });

  it('offers to resume, restart or end the game, resume first', async () => {
    const { dialog } = await setUp();

    expect(Array.from(dialog.querySelectorAll('button'), (b) => b.textContent.trim())).toEqual([
      'Resume',
      'Restart',
      'End Game',
    ]);
    expect(dialog.querySelector('button')?.hasAttribute('autofocus')).toBe(true);
  });

  it('shows and hides the touch areas, in developer mode only', async () => {
    const { host, pause } = await setUp();
    const toggle = (): HTMLInputElement | null =>
      host.querySelector<HTMLInputElement>('label.toggle input[type="checkbox"]');
    expect(toggle()).toBeNull();

    await TestBed.inject(DeveloperMode).set(true);
    TestBed.tick();
    expect(toggle()?.closest('label')?.textContent.trim()).toBe('Show Touch Areas');
    expect(toggle()?.checked).toBe(false);

    toggle()?.click();
    expect(pause.showTouchAreas()).toBe(true);
    toggle()?.click();
    expect(pause.showTouchAreas()).toBe(false);
  });

  it('moves between its buttons with the up and down keys, round from either end', async () => {
    const { dialog, click } = await setUp();
    await click('Pause');
    const focused = (): string | undefined => document.activeElement?.textContent.trim();
    const press = (key: string): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      const active = document.activeElement;
      (active !== null && dialog.contains(active)
        ? active
        : dialog.querySelector('app-button-list')
      )?.dispatchEvent(event);
      return event;
    };

    (document.activeElement as HTMLElement | null)?.blur();
    expect(press('ArrowUp').defaultPrevented).toBe(true);
    expect(focused()).toBe('End Game');
    press('ArrowDown');
    expect(focused()).toBe('Resume');
    press('ArrowDown');
    expect(focused()).toBe('Restart');
    press('ArrowUp');
    expect(focused()).toBe('Resume');
    press('ArrowUp');
    expect(focused()).toBe('End Game');
  });

  for (const label of ['Resume', 'Restart', 'End Game']) {
    it(`closes and resumes on ${label}`, async () => {
      const { pause, dialog, click } = await setUp();
      await click('Pause');

      await click(label);

      expect(dialog.open).toBe(false);
      expect(pause.paused()).toBe(false);
    });
  }

  it('offers to stop and replay the run only once there is one, replaying it once the dialog has closed', async () => {
    const { pause, dialog, click, replayable } = await setUp();
    const replay = vi.fn();
    pause.replay.subscribe(replay);
    const labels = (): string[] =>
      Array.from(dialog.querySelectorAll('button'), (button) => button.textContent.trim());
    expect(labels()).not.toContain('Stop and Replay This Run');

    await replayable();
    expect(labels()).toEqual(['Resume', 'Restart', 'Stop and Replay This Run', 'End Game']);

    await click('Pause');
    await click('Stop and Replay This Run');
    await new Promise((resolve) => setTimeout(resolve));

    expect(dialog.open).toBe(false);
    expect(replay).toHaveBeenCalledOnce();
  });

  it('resumes when the dialog closes on its own, as with Escape', async () => {
    const { pause, dialog, click } = await setUp();
    await click('Pause');

    dialog.close();

    expect(pause.paused()).toBe(false);
  });

  it('asks for a restart only on Restart', async () => {
    const { pause, click } = await setUp();
    const restart = vi.fn();
    pause.restart.subscribe(restart);
    await click('Pause');

    await click('Resume');
    expect(restart).not.toHaveBeenCalled();

    await click('Pause');
    await click('Restart');
    expect(restart).toHaveBeenCalledOnce();
  });

  it('ends the game once the dialog has finished closing', async () => {
    const { dialog, click } = await setUp();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    let finish = (): void => undefined;
    const closing = {
      finished: new Promise<void>((resolve) => (finish = resolve)),
    } as unknown as Animation;
    dialog.getAnimations = (): Animation[] => [closing];
    await click('Pause');

    await click('End Game');
    expect(navigate).not.toHaveBeenCalled();

    finish();
    await new Promise((resolve) => setTimeout(resolve));
    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('ends the game even when the browser cancels the dialog’s closing transitions as it hides it', async () => {
    const { dialog, click } = await setUp();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const cancelled = Promise.reject(new DOMException('Cancelled', 'AbortError'));
    cancelled.catch(() => undefined);
    dialog.getAnimations = (): Animation[] => [{ finished: cancelled } as unknown as Animation];
    await click('Pause');

    await click('End Game');
    await new Promise((resolve) => setTimeout(resolve));
    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });
});
