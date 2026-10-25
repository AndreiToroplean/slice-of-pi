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

    expect(
      Array.from(dialog.querySelectorAll('app-button-list button'), (b) => b.textContent.trim()),
    ).toEqual(['Resume', 'Restart', 'End Game']);
    expect(dialog.querySelector('app-button-list button')?.hasAttribute('autofocus')).toBe(true);
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

  it('offers to replay the run, saying so on hover too, disabled until there is one', async () => {
    const { dialog, replayable } = await setUp();
    const replayButton = (): HTMLButtonElement | null =>
      dialog.querySelector('button[aria-label="Replay This Run"]');
    expect(replayButton()?.title).toBe('Replay This Run');
    expect(replayButton()?.disabled).toBe(true);

    await replayable();
    expect(replayButton()?.disabled).toBe(false);
    expect(dialog.querySelector('[autofocus]')?.textContent.trim()).toBe('Resume');
  });

  it('asks before replaying the run, warning that the game cannot be resumed then', async () => {
    const { host, pause, dialog, click, replayable } = await setUp();
    const replay = vi.fn();
    pause.replay.subscribe(replay);
    await replayable();
    const confirmation = host.querySelector('dialog[aria-labelledby="replay-title"]');
    if (!(confirmation instanceof HTMLDialogElement)) {
      throw new Error('No confirmation');
    }
    expect(host.querySelector('#replay-title')?.textContent).toBe('Watch the Replay?');
    const warning = confirmation.getAttribute('aria-describedby') ?? '';
    expect(host.querySelector(`#${warning}`)?.textContent).toContain('won’t be able to resume');
    await click('Pause');

    await click('Replay This Run');
    expect(confirmation.open).toBe(true);
    await click('Back');
    expect(confirmation.open).toBe(false);
    expect(dialog.open).toBe(true);
    expect(replay).not.toHaveBeenCalled();

    await click('Replay This Run');
    await click('Watch Replay');
    await new Promise((resolve) => setTimeout(resolve));
    expect(confirmation.open).toBe(false);
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
