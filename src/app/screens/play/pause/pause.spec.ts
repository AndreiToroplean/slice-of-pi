import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { dialogNamed, installDialogs, uninstallDialogs } from '../../../../testing/fake-dialogs';
import { GameMode } from '../../../game/modes/game-mode';
import { DeveloperMode } from '../../../developer-mode/developer-mode';
import { INDEXED_DB } from '../../../player-data/run-store';
import { Pause } from './pause';
import { pressKey } from '../../../../testing/keys';

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

  async function setUp(mode: GameMode = 'free'): Promise<{
    host: HTMLElement;
    pause: Pause;
    dialog: HTMLDialogElement;
    click: (label: string) => Promise<void>;
    pauseGame: () => Promise<void>;
    replayable: () => Promise<void>;
  }> {
    const fixture = TestBed.createComponent(Pause);
    fixture.componentRef.setInput('mode', mode);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const dialog = dialogNamed(host, 'Paused');
    const click = async (label: string): Promise<void> => {
      Array.from(host.querySelectorAll('button'))
        .find((button) => button.textContent.trim() === label || button.title === label)
        ?.click();
      await fixture.whenStable();
    };
    /** Pauses, as the pause key does. */
    const pauseGame = async (): Promise<void> => {
      fixture.componentInstance.pause();
      await fixture.whenStable();
    };
    const replayable = async (): Promise<void> => {
      fixture.componentRef.setInput('replayable', true);
      await fixture.whenStable();
    };
    return { host, pause: fixture.componentInstance, dialog, click, pauseGame, replayable };
  }

  it('pauses, opening a dialog named after its heading', async () => {
    const { pause, dialog, pauseGame } = await setUp();
    expect(dialog.open).toBe(false);

    await pauseGame();

    expect(dialog.open).toBe(true);
    expect(pause.paused()).toBe(true);
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

  it('offers to resume, restart or end the game, and in free play to continue in Discovery', async () => {
    const choices = async (mode: GameMode): Promise<string[]> => {
      const { dialog } = await setUp(mode);
      return Array.from(dialog.querySelectorAll('app-button-list button'), (b) =>
        b.textContent.trim(),
      );
    };

    expect(await choices('challenge')).toEqual(['Resume', 'Restart', 'End Game']);
    expect(await choices('discovery')).toEqual(['Resume', 'Restart', 'End Game']);
    expect(await choices('free')).toEqual([
      'Resume',
      'Restart',
      'Continue in Discovery',
      'End Game',
    ]);
  });

  it('offers to edit the layout in developer mode only, staying paused while it’s edited', async () => {
    const { host, pause, dialog, click, pauseGame } = await setUp();
    let edits = 0;
    pause.edit.subscribe(() => edits++);
    const offered = (): boolean => host.querySelector('button[title="Edit Layout"]') !== null;
    expect(offered()).toBe(false);

    await TestBed.inject(DeveloperMode).set(true);
    TestBed.tick();
    expect(offered()).toBe(true);
    await pauseGame();
    await click('Edit Layout');

    expect(dialog.open).toBe(false);
    expect(pause.paused()).toBe(true);
    expect(edits).toBe(1);
    pause.pause();
    await click('Resume');
    expect(pause.paused()).toBe(false);
    expect(edits).toBe(1);
  });

  it('moves between its buttons with the up and down keys, round from either end', async () => {
    const { dialog, pauseGame } = await setUp();
    await pauseGame();
    const focused = (): string | undefined => document.activeElement?.textContent.trim();
    const press = (key: string): KeyboardEvent => {
      const active = document.activeElement;
      return pressKey(
        key,
        active !== null && dialog.contains(active)
          ? active
          : dialog.querySelector('app-button-list'),
      );
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
      const { pause, dialog, click, pauseGame } = await setUp();
      await pauseGame();

      await click(label);

      expect(dialog.open).toBe(false);
      expect(pause.paused()).toBe(false);
    });
  }

  it('offers to replay the run, saying so on hover too, disabled until there is one', async () => {
    const { dialog, replayable } = await setUp();
    const replayButton = (): HTMLButtonElement | null =>
      dialog.querySelector('button[title="Replay This Run"]');
    expect(replayButton()?.title).toBe('Replay This Run');
    expect(replayButton()?.disabled).toBe(true);

    await replayable();
    expect(replayButton()?.disabled).toBe(false);
  });

  it('asks before replaying the run, warning that the game cannot be resumed then', async () => {
    const { host, pause, dialog, click, replayable, pauseGame } = await setUp();
    const replay = vi.fn();
    pause.replay.subscribe(replay);
    await replayable();
    const confirmation = dialogNamed(host, 'Watch the Replay?');
    const warning = confirmation.getAttribute('aria-describedby') ?? '';
    expect(host.querySelector(`#${warning}`)?.textContent).toContain('won’t be able to resume');
    await pauseGame();

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

  it('pauses again on an Escape right after the dialog has gone, before it says it has closed', async () => {
    const { pause, dialog } = await setUp();
    const escape = (): void => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    };
    escape();
    // Gone, as the browser hides it at once without motion, its close event yet to come.
    dialog.removeAttribute('open');

    escape();
    dialog.dispatchEvent(new Event('close'));

    expect(dialog.open).toBe(true);
    expect(pause.paused()).toBe(true);
  });

  it('pauses again on Back right after the dialog has gone, before it says it has closed', async () => {
    const { pause, dialog } = await setUp();
    pause.back();
    dialog.removeAttribute('open');

    pause.back();
    dialog.dispatchEvent(new Event('close'));

    expect(dialog.open).toBe(true);
    expect(pause.paused()).toBe(true);
  });

  it('keeps the game over dialog open on Back, the game staying paused', async () => {
    const { host, pause } = await setUp();
    pause.gameOver();

    pause.back();

    expect(dialogNamed(host, 'Game Over').open).toBe(true);
    expect(pause.paused()).toBe(true);
  });

  it('resumes when the dialog closes on its own, as with Escape', async () => {
    const { pause, dialog, pauseGame } = await setUp();
    await pauseGame();

    dialog.close();

    expect(pause.paused()).toBe(false);
  });

  it('asks for a restart only on Restart', async () => {
    const { pause, click, pauseGame } = await setUp();
    const restart = vi.fn();
    pause.restart.subscribe(restart);
    await pauseGame();

    await click('Resume');
    expect(restart).not.toHaveBeenCalled();

    await pauseGame();
    await click('Restart');
    expect(restart).toHaveBeenCalledOnce();
  });

  it('ends the game once the dialog has finished closing', async () => {
    const { dialog, click, pauseGame } = await setUp();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    let finish = (): void => undefined;
    const closing = {
      finished: new Promise<void>((resolve) => (finish = resolve)),
    } as unknown as Animation;
    dialog.getAnimations = (): Animation[] => [closing];
    await pauseGame();

    await click('End Game');
    expect(navigate).not.toHaveBeenCalled();

    finish();
    await new Promise((resolve) => setTimeout(resolve));
    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('ends the game even when the browser cancels the dialog’s closing transitions as it hides it', async () => {
    const { dialog, click, pauseGame } = await setUp();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const cancelled = Promise.reject(new DOMException('Cancelled', 'AbortError'));
    cancelled.catch(() => undefined);
    dialog.getAnimations = (): Animation[] => [{ finished: cancelled } as unknown as Animation];
    await pauseGame();

    await click('End Game');
    await new Promise((resolve) => setTimeout(resolve));
    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });
});
