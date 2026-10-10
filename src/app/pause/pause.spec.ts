import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { installDialogs, uninstallDialogs } from '../../testing/fake-dialogs';
import { Pause } from './pause';

describe('Pause', () => {
  beforeEach(() => {
    installDialogs();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => {
    uninstallDialogs();
  });

  async function setUp(): Promise<{
    host: HTMLElement;
    pause: Pause;
    dialog: HTMLDialogElement;
    click: (label: string) => Promise<void>;
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
    return { host, pause: fixture.componentInstance, dialog, click };
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

  it('offers to resume, restart or end the game, resume first', async () => {
    const { dialog } = await setUp();

    expect(Array.from(dialog.querySelectorAll('button'), (b) => b.textContent.trim())).toEqual([
      'Resume',
      'Restart',
      'End game',
    ]);
    expect(dialog.querySelector('button')?.hasAttribute('autofocus')).toBe(true);
  });

  for (const label of ['Resume', 'Restart', 'End game']) {
    it(`closes and resumes on ${label}`, async () => {
      const { pause, dialog, click } = await setUp();
      await click('Pause');

      await click(label);

      expect(dialog.open).toBe(false);
      expect(pause.paused()).toBe(false);
    });
  }

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

    await click('End game');
    expect(navigate).not.toHaveBeenCalled();

    finish();
    await new Promise((resolve) => setTimeout(resolve));
    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });
});
